const { Worker } = require('bullmq');
const { createContext, createPage, closeContext } = require('../scraper/browser');
const { scrapeCategory, discoverMachines } = require('../scraper/categoryScraper');
const { scrapeMachineDetail } = require('../scraper/machineScraper');
const { downloadZipWithPlaywright } = require('../scraper/zipDownloader');
const { uploadZipToSupabase } = require('../storage/uploader');
const { addMachineJobs } = require('./scrapeQueue');
const queries = require('../database/queries');
const logger = require('../services/logger');
const { sanitizeFilename } = require('../utils/fileHelpers');
const config = require('../config');
const path = require('path');
const fs = require('fs');
const { randomDelay } = require('../utils/delay');

const connection = {
  host: config.redisHost,
  port: config.redisPort,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: () => null,
  lazyConnect: true,
};

const createScrapeWorker = () => {
  const worker = new Worker('scrape', async (job) => {
    const { website, category, jobId } = job.data;
    logger.info(`[WORKER] Starting scrape job: ${job.id}`, { website });

    let context = null;
    try {
      await queries.updateJobStatus(jobId || job.id, { status: 'in_progress' });

      context = await createContext();
      const page = await createPage(context);

      const { url: categoryUrl } = await scrapeCategory(page, website, category);

      await queries.updateJobStatus(jobId || job.id, { status: 'discovering' });

      const machines = await discoverMachines(page, categoryUrl, website, category);

      if (machines.length === 0) {
        logger.warn(`[WORKER] No machines found`);
        await queries.updateJobStatus(jobId || job.id, { status: 'completed', total_items: 0 });
        return { machines: [], message: 'No machines found' };
      }

      logger.info(`[WORKER] Discovered ${machines.length} machines`);
      await queries.updateJobStatus(jobId || job.id, {
        status: 'scraping',
        total_items: machines.length,
      });

      await addMachineJobs(machines, job.id);

      return { machines: machines.length, website };
    } catch (error) {
      logger.error(`[WORKER] Scrape job ${job.id} failed`, { error: error.message });
      await queries.updateJobStatus(jobId || job.id, { status: 'failed' }).catch(() => {});
      throw error;
    } finally {
      if (context) await closeContext(context);
    }
  }, { connection, concurrency: config.maxConcurrentJobs });

  return worker;
};

const createMachineWorker = () => {
  const worker = new Worker('machine-scrape', async (job) => {
    const machine = job.data;
    const safeName = sanitizeFilename(machine.machine_name);

    logger.info(`[MACHINE_WORKER] Processing: ${machine.machine_name}`);

    let context = null;
    try {
      context = await createContext();
      const page = await createPage(context);

      const detail = await scrapeMachineDetail(page, machine);

      if (!detail.lot_number) {
        logger.warn(`[MACHINE_WORKER] No lot_number found for ${machine.machine_name}, using fallback`);
      }

      let zipData = null;
      if (detail.lot_number) {
        try {
          const zipFileName = `${safeName}.zip`;
          const zipPath = path.join(config.downloadsDir, zipFileName);

          const result = await downloadZipWithPlaywright(page, zipPath, machine.machine_name);

          if (result) {
            const storagePath = `jen-auction/${detail.lot_number}`;
            const uploadResult = await uploadZipToSupabase(result.filePath, storagePath);

            zipData = {
              zip_file_name: result.fileName,
              zip_file_size: result.fileSize,
              zip_storage_path: uploadResult.storagePath,
              zip_public_url: uploadResult.publicUrl,
              zip_downloaded_at: new Date().toISOString(),
            };

            if (fs.existsSync(result.filePath)) {
              fs.unlinkSync(result.filePath);
            }
          }
        } catch (zipError) {
          logger.warn(`[MACHINE_WORKER] ZIP download/upload failed for ${machine.machine_name}`, {
            error: zipError.message
          });
        }

        await randomDelay(1000, 3000);
      }

      const dbRecord = {
        maker: detail.maker,
        model: detail.model,
        serial_number: detail.serial_number,
        year: detail.year,
        hour_meter: detail.hour_meter,
        lot_number: detail.lot_number,
        delivery_yard: detail.delivery_yard,
        start_price_jpy: detail.start_price_jpy,
        bid_increment_jpy: detail.bid_increment_jpy,
        releasing_charge_jpy: detail.releasing_charge_jpy,
        feature_comment: detail.feature_comment,
        source_url: detail.source_url,
        ...(zipData || {}),
      };

      await queries.upsertAuction(dbRecord)

      logger.info(`[MACHINE_WORKER] Completed: ${detail.maker} ${detail.model} (Lot: ${detail.lot_number})`);
      await queries.incrementJobProcessed(job.data.parentJobId);

      return { status: 'completed', machine: machine.machine_name, lot: detail.lot_number };
    } catch (error) {
      logger.error(`[MACHINE_WORKER] Failed: ${machine.machine_name}`, { error: error.message });
      if (context) await closeContext(context);

      const jobParentId = job.data.parentJobId;
      if (jobParentId) {
        await queries.incrementJobFailed(jobParentId).catch(() => {});
      }
      throw error;
    } finally {
      if (context) await closeContext(context);
    }
  }, { connection, concurrency: config.scrapeConcurrency });

  return worker;
};

module.exports = { createScrapeWorker, createMachineWorker };

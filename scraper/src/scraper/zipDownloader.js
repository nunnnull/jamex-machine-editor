const fs = require('fs');
const path = require('path');
const logger = require('../services/logger');
const { retry } = require('../services/retryService');
const { ensureDir } = require('../utils/fileHelpers');
const { validateZipBuffer } = require('../services/validationService');
const config = require('../config');
const SelectorAI = require('./selectorAI');

const downloadZipWithPlaywright = async (page, outputPath, machineName) => {
  logger.info(`[ZIP_DOWNLOAD] Looking for Download Photo button for ${machineName}`);

  return retry(async () => {
    ensureDir(path.dirname(outputPath));
    await page.waitForTimeout(1000);

    const selectorAI = new SelectorAI(page);
    const downloadInfo = await selectorAI.detectDownloadButton();

    if (!downloadInfo) {
      logger.warn(`[ZIP_DOWNLOAD] No download button found for ${machineName}`);
      return null;
    }

    logger.info(`[ZIP_DOWNLOAD] Found download button: "${downloadInfo.text}"`);

    if (downloadInfo.href) {
      const fullUrl = new URL(downloadInfo.href, page.url()).href;
      logger.info(`[ZIP_DOWNLOAD] Navigating to download URL: ${fullUrl}`);

      const downloadPromise = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);

      await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 60000 });

      const download = await downloadPromise;

      if (download) {
        await download.saveAs(outputPath);
        const stats = fs.statSync(outputPath);
        logger.info(`[ZIP_DOWNLOAD] ZIP downloaded via browser (${(stats.size / 1024 / 1024).toFixed(2)} MB): ${path.basename(outputPath)}`);

        const buffer = fs.readFileSync(outputPath);
        if (!validateZipBuffer(buffer)) {
          logger.warn(`[ZIP_DOWNLOAD] Downloaded file is not a valid ZIP for ${machineName}`);
        }

        return { filePath: outputPath, fileSize: stats.size, fileName: path.basename(outputPath) };
      }

      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        const buffer = fs.readFileSync(outputPath);
        if (buffer.length > 0) {
          logger.info(`[ZIP_DOWNLOAD] ZIP file saved (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
          return { filePath: outputPath, fileSize: stats.size, fileName: path.basename(outputPath) };
        }
      }
    }

    logger.info(`[ZIP_DOWNLOAD] Attempting click on download button`);
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);

    const buttonSelector = `a[class*="download"], a[href*="imgzip"], .download_photo a, a.download_photo`;
    const btn = await page.$(buttonSelector);
    if (btn) {
      await btn.click();
    } else {
      await page.click('a:has-text("Download Photo")');
    }

    await page.waitForTimeout(3000);
    const download = await downloadPromise;

    if (download) {
      await download.saveAs(outputPath);
      const stats = fs.statSync(outputPath);
      logger.info(`[ZIP_DOWNLOAD] ZIP downloaded via click (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      return { filePath: outputPath, fileSize: stats.size, fileName: path.basename(outputPath) };
    }

    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
      const stats = fs.statSync(outputPath);
      return { filePath: outputPath, fileSize: stats.size, fileName: path.basename(outputPath) };
    }

    logger.warn(`[ZIP_DOWNLOAD] Download failed for ${machineName}`);
    return null;
  }, {
    maxRetries: config.maxRetries,
    baseDelay: 2000,
    context: `Download ZIP for ${machineName}`,
  });
};

module.exports = { downloadZipWithPlaywright };

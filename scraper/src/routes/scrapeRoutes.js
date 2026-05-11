const express = require('express');
const router = express.Router();
const { addScrapeJob, getQueueStatus } = require('../queue/scrapeQueue');
const queries = require('../database/queries');
const { validateScrapeRequest, sanitizeRequest } = require('../services/validationService');
const logger = require('../services/logger');

router.post('/scrape', async (req, res) => {
  try {
    const errors = validateScrapeRequest(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const { website } = sanitizeRequest(req.body);

    const job = await queries.createScrapeJob({ website });
    const jobId = job.id;

    const queueJob = await addScrapeJob({ website, jobId });

    logger.info(`[API] Scrape request submitted: ${website} (job: ${jobId})`);

    res.status(201).json({
      success: true,
      message: 'Scrape job created',
      data: {
        jobId,
        queueJobId: queueJob.id,
        website,
        status: 'pending',
      },
    });
  } catch (error) {
    logger.error('[API] Failed to create scrape job', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to create scrape job' });
  }
});

router.post('/jobs/:id/retry', async (req, res) => {
  try {
    const { id } = req.params;
    const job = await queries.getJob(id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    await addScrapeJob({ website: job.website, jobId: id });
    await queries.updateJobStatus(id, { status: 'pending' });
    logger.info(`[API] Job ${id} queued for retry`);
    res.json({ success: true, message: 'Job queued for retry' });
  } catch (error) {
    logger.error('[API] Failed to retry job', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to retry job' });
  }
});

router.get('/jobs', async (req, res) => {
  try {
    const jobs = await queries.getJobs();
    const queueStatus = await getQueueStatus().catch(() => ({}));
    res.json({ success: true, data: { jobs, queue: queueStatus } });
  } catch (error) {
    logger.error('[API] Failed to get jobs', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to get jobs' });
  }
});

module.exports = router;

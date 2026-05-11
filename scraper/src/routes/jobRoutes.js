const express = require('express');
const router = express.Router();
const queries = require('../database/queries');
const { getQueueStatus } = require('../queue/scrapeQueue');
const logger = require('../services/logger');

router.get('/jobs', async (req, res) => {
  try {
    const jobs = await queries.getJobs();
    const queueStatus = await getQueueStatus().catch(() => ({}));
    res.json({ success: true, data: { jobs, queue: queueStatus } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get jobs' });
  }
});

router.get('/jobs/:id', async (req, res) => {
  try {
    const job = await queries.getJob(req.params.id);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    res.json({ success: true, data: job });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get job' });
  }
});

module.exports = router;

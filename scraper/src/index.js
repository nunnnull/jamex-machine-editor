require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const logger = require('./services/logger');
const { isRedisAvailable } = require('./utils/redisCheck');
const scrapeRoutes = require('./routes/scrapeRoutes');
const machineRoutes = require('./routes/machineRoutes');
const jobRoutes = require('./routes/jobRoutes');
const config = require('./config');

const app = express();
app.use(express.json());

[config.tempDir, config.downloadsDir, config.logsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

app.use('/api', scrapeRoutes);
app.use('/api', machineRoutes);
app.use('/api', jobRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use((err, req, res, next) => {
  logger.error('[APP] Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ success: false, error: 'Internal server error' });
});

let scrapeWorker = null;
let machineWorker = null;

const startWorkers = async () => {
  const redisOk = await isRedisAvailable();
  if (!redisOk) {
    logger.info('[APP] Server running without queue workers (Redis unavailable)');
    return;
  }

  try {
    const { createScrapeWorker, createMachineWorker } = require('./queue/workers');
    scrapeWorker = await createScrapeWorker();
    machineWorker = await createMachineWorker();
    if (scrapeWorker || machineWorker) {
      logger.info('[APP] Queue workers started');
    }
  } catch (error) {
    logger.warn('[APP] Failed to start queue workers', { error: error.message });
  }
};

const gracefulShutdown = async () => {
  logger.info('[APP] Shutting down gracefully...');
  if (scrapeWorker) await scrapeWorker.close().catch(() => {});
  if (machineWorker) await machineWorker.close().catch(() => {});
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`[APP] Server running on port ${PORT}`);
  logger.info(`[APP] Health check: http://localhost:${PORT}/api/health`);
  startWorkers();
});

module.exports = app;

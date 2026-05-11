const { Queue } = require('bullmq');
const config = require('../config');
const logger = require('../services/logger');

const getConnection = () => {
  const conn = {
    host: config.redisHost,
    port: config.redisPort,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: () => null,
    lazyConnect: true,
  };
  return conn;
};

let scrapeQueue = null;
let machineQueue = null;

const suppressErrors = (q) => {
  if (!q) return;
  try {
    if (q.client) q.client.on('error', () => {});
  } catch {}
};

const getScrapeQueue = () => {
  if (!scrapeQueue) {
    try {
      scrapeQueue = new Queue('scrape', {
        connection: getConnection(),
        defaultJobOptions: {
          attempts: config.maxRetries,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      });
      suppressErrors(scrapeQueue);
    } catch (error) {
      logger.warn('[QUEUE] Failed to create scrape queue (Redis may be unavailable)', {
        error: error.message
      });
      return null;
    }
  }
  return scrapeQueue;
};

const getMachineQueue = () => {
  if (!machineQueue) {
    try {
      machineQueue = new Queue('machine-scrape', {
        connection: getConnection(),
        defaultJobOptions: {
          attempts: config.maxRetries,
          backoff: { type: 'exponential', delay: 3000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      });
      suppressErrors(machineQueue);
    } catch (error) {
      logger.warn('[QUEUE] Failed to create machine queue (Redis may be unavailable)', {
        error: error.message
      });
      return null;
    }
  }
  return machineQueue;
};

const addScrapeJob = async (data) => {
  const q = getScrapeQueue();
  if (!q) {
    logger.warn('[QUEUE] Redis unavailable, using direct processing fallback');
    return { id: 'direct-' + Date.now(), data };
  }
  try {
    const job = await q.add('scrape-website', data, {
      jobId: `scrape-${Date.now()}`,
    });
    logger.info(`[QUEUE] Scrape job added: ${job.id}`);
    return job;
  } catch (error) {
    logger.warn('[QUEUE] Redis unavailable (connection failed), using fallback');
    scrapeQueue = null;
    return { id: 'direct-' + Date.now(), data };
  }
};

const addMachineJobs = async (machines, parentJobId) => {
  const q = getMachineQueue();
  if (!q) return [];
  const jobs = [];
  for (const machine of machines) {
    try {
      const job = await q.add('scrape-machine', machine, {
        jobId: `machine-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
      jobs.push(job);
    } catch (error) {
      logger.warn('[QUEUE] Redis unavailable (connection failed), skipping machine queue');
      machineQueue = null;
      return [];
    }
  }
  logger.info(`[QUEUE] ${jobs.length} machine jobs added for parent job ${parentJobId}`);
  return jobs;
};

const getQueueStatus = async () => {
  const sq = getScrapeQueue();
  const mq = getMachineQueue();
  if (!sq && !mq) return { scrape: {}, machine: {} };

  const defaultState = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };

  try {
    const [scrape, machine] = await Promise.all([
      sq ? Promise.all([
        sq.getWaitingCount(), sq.getActiveCount(),
        sq.getCompletedCount(), sq.getFailedCount(), sq.getDelayedCount()
      ]) : [0, 0, 0, 0, 0],
      mq ? Promise.all([
        mq.getWaitingCount(), mq.getActiveCount(),
        mq.getCompletedCount(), mq.getFailedCount(), mq.getDelayedCount()
      ]) : [0, 0, 0, 0, 0],
    ]);

    return {
      scrape: { waiting: scrape[0], active: scrape[1], completed: scrape[2], failed: scrape[3], delayed: scrape[4] },
      machine: { waiting: machine[0], active: machine[1], completed: machine[2], failed: machine[3], delayed: machine[4] },
    };
  } catch {
    return { scrape: defaultState, machine: defaultState };
  }
};

module.exports = {
  addScrapeJob,
  addMachineJobs,
  getQueueStatus,
};

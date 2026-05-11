const net = require('net');
const config = require('../config');
const logger = require('../services/logger');

const checkRedis = () => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(config.redisPort, config.redisHost);
  });
};

let redisAvailable = null;

const isRedisAvailable = async () => {
  if (redisAvailable !== null) return redisAvailable;
  redisAvailable = await checkRedis();
  if (!redisAvailable) {
    logger.warn('[REDIS] Redis is not available. Queue workers will not start.');
    logger.info('[REDIS] Scraping will work via API but jobs won\'t be queued. Install/start Redis to enable queue processing.');
  }
  return redisAvailable;
};

module.exports = { isRedisAvailable, checkRedis };

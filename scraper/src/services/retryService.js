const logger = require('./logger');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const retry = async (fn, options = {}) => {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    factor = 2,
    onRetry = null,
    context = '',
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) {
        logger.error(`[RETRY_EXHAUSTED] ${context} - All ${maxRetries} attempts failed`, {
          error: error.message
        });
        throw error;
      }

      const delay = Math.min(baseDelay * Math.pow(factor, attempt - 1), maxDelay);
      const jitter = Math.random() * 1000;
      const totalDelay = delay + jitter;

      logger.warn(`[RETRY] ${context} - Attempt ${attempt}/${maxRetries} failed. Retrying in ${Math.round(totalDelay)}ms`, {
        error: error.message
      });

      if (onRetry) {
        onRetry(attempt, error);
      }

      await sleep(totalDelay);
    }
  }

  throw lastError;
};

module.exports = { retry, sleep };

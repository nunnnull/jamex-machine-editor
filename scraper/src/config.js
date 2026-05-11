require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT, 10) || 6379,
  headless: process.env.HEADLESS === 'true',
  maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS, 10) || 5,
  storageMode: process.env.STORAGE_MODE || 'supabase',
  logLevel: process.env.LOG_LEVEL || 'info',
  browserTimeout: parseInt(process.env.BROWSER_TIMEOUT, 10) || 30000,
  maxRetries: parseInt(process.env.MAX_RETRIES, 10) || 3,
  scrapeConcurrency: parseInt(process.env.SCRAPE_CONCURRENCY, 10) || 5,
  storageBucket: 'machine-photos',
  tempDir: 'temp',
  downloadsDir: 'downloads',
  logsDir: 'logs',
  allowedImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
  rejectedExtensions: ['.exe', '.php', '.js', '.html', '.sh', '.bat', '.cmd', '.vbs', '.ps1'],
};

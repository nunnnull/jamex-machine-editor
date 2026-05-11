const { chromium } = require('playwright');
const config = require('../config');
const logger = require('../services/logger');

let browser = null;
let contextCount = 0;

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

const getRandomUserAgent = () => {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
};

const launchBrowser = async () => {
  if (browser && browser.isConnected()) {
    return browser;
  }

  logger.info('[BROWSER] Launching Chromium...');
  browser = await chromium.launch({
    headless: config.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });

  logger.info('[BROWSER] Browser launched successfully');
  return browser;
};

const createContext = async () => {
  const browser = await launchBrowser();
  contextCount++;

  const context = await browser.newContext({
    userAgent: getRandomUserAgent(),
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    permissions: [],
    javaScriptEnabled: true,
    bypassCSP: true,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  });

  return context;
};

const createPage = async (context) => {
  const page = await context.newPage();
  page.setDefaultTimeout(config.browserTimeout);
  page.setDefaultNavigationTimeout(config.browserTimeout);

  await page.addInitScript(() => {
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (params) => (
      params.name === 'notifications'
        ? Promise.resolve({ state: 'denied' })
        : originalQuery(params)
    );
  });

  return page;
};

const closeContext = async (context) => {
  try {
    await context.close();
  } catch (error) {
    logger.warn('[BROWSER] Error closing context', { error: error.message });
  }
};

const closeBrowser = async () => {
  if (browser) {
    try {
      await browser.close();
      logger.info('[BROWSER] Browser closed');
    } catch (error) {
      logger.warn('[BROWSER] Error closing browser', { error: error.message });
    }
    browser = null;
  }
};

const detectCaptcha = async (page) => {
  const captchaIndicators = [
    'recaptcha',
    'cf-challenge',
    'captcha',
    'challenge-platform',
    'g-recaptcha',
    'h-captcha',
    'turnstile',
  ];

  const pageContent = await page.content();
  const lowerContent = pageContent.toLowerCase();

  for (const indicator of captchaIndicators) {
    if (lowerContent.includes(indicator)) {
      return true;
    }
  }

  const visible = await page.locator('[id*="captcha"], [class*="captcha"], iframe[src*="captcha"], iframe[src*="recaptcha"]').first().isVisible().catch(() => false);
  return visible;
};

const detectCloudflare = async (page) => {
  const title = await page.title().catch(() => '');
  const bodyText = await page.locator('body').textContent().catch(() => '');
  return (
    title.includes('Just a moment') ||
    bodyText.includes('Checking your browser') ||
    bodyText.includes('DDoS protection') ||
    bodyText.includes('Cloudflare')
  );
};

module.exports = {
  launchBrowser,
  createContext,
  createPage,
  closeContext,
  closeBrowser,
  detectCaptcha,
  detectCloudflare,
};

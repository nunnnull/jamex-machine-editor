const logger = require('../services/logger');
const { randomDelay } = require('../utils/delay');
const { normalizeUrl } = require('../utils/urlHelpers');

const handlePagination = async (page, baseUrl) => {
  const paginationResult = {
    hasNext: false,
    nextUrl: null,
    allUrls: [page.url()],
  };

  try {
    const nextLink = await page.evaluate(() => {
      const selectors = [
        'a.next', 'a[rel="next"]', '.next a',
        '.pagination .next a', '.page-nav .next a',
        'a:has-text("Next")', 'a:has-text("next")',
        'a:has-text(">")', 'a:has-text("»")',
        '.pagination a:last-child',
      ];
      for (const selector of selectors) {
        try {
          const el = document.querySelector(selector);
          if (el) return el.getAttribute('href');
        } catch { /* ignore */ }
      }
      return null;
    });

    if (nextLink && nextLink !== '#') {
      const nextUrl = normalizeUrl(baseUrl, nextLink);
      if (nextUrl && nextUrl !== page.url()) {
        paginationResult.hasNext = true;
        paginationResult.nextUrl = nextUrl;
        logger.debug(`[PAGINATION] Next page found: ${nextUrl}`);
      }
    }
  } catch (error) {
    logger.warn('[PAGINATION] Error detecting pagination', { error: error.message });
  }

  return paginationResult;
};

const scrapeAllPages = async (page, startUrl, scrapeFn) => {
  const allItems = [];
  let currentUrl = startUrl;
  let pageNum = 1;
  let hasMore = true;

  while (hasMore) {
    logger.info(`[PAGINATION] Processing page ${pageNum}: ${currentUrl}`);

    if (currentUrl !== page.url()) {
      await page.goto(currentUrl, { waitUntil: 'networkidle', timeout: 60000 });
      await randomDelay(2000, 4000);
    }

    const items = await scrapeFn(page);
    allItems.push(...items);

    const pagination = await handlePagination(page, startUrl);
    if (pagination.hasNext && pagination.nextUrl) {
      currentUrl = pagination.nextUrl;
      pageNum++;
      await randomDelay(1500, 3000);
    } else {
      hasMore = false;
    }
  }

  logger.info(`[PAGINATION] Collected ${allItems.length} items from ${pageNum} pages`);
  return allItems;
};

module.exports = { handlePagination, scrapeAllPages };

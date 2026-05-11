const logger = require('../services/logger');
const SelectorAI = require('./selectorAI');
const { normalizeUrl } = require('../utils/urlHelpers');
const { randomDelay } = require('../utils/delay');

const scrapeCategory = async (page, website, targetCategory) => {
  logger.info(`[CATEGORY] Navigating to ${website}`);
  await page.goto(website, { waitUntil: 'networkidle', timeout: 60000 });
  await randomDelay(2000, 4000);

  const selectorAI = new SelectorAI(page);

  const { items } = await selectorAI.detectMachineListings();
  if (items.length > 0) {
    logger.info(`[CATEGORY] Machines found directly on main page — skipping category navigation`);
    return { found: true, url: page.url(), direct: true };
  }

  const allLinks = await selectorAI.detectCategoryLinks();
  logger.debug(`[CATEGORY] Detected ${allLinks.length} potential category links`);

  if (allLinks.length === 0) {
    logger.warn(`[CATEGORY] No category links found — using main URL as listing page`);
    return { found: true, url: page.url(), direct: true };
  }

  const matched = selectorAI.findCategoryByText(allLinks, targetCategory);

  if (matched.length === 0) {
    logger.warn(`[CATEGORY] No matching category found for "${targetCategory}" — using main URL`);
    return { found: true, url: page.url(), direct: true };
  }

  const bestMatch = matched[0];
  logger.info(`[CATEGORY] Best category match: "${bestMatch.text}" (score: ${bestMatch.score})`);

  const categoryUrl = normalizeUrl(website, bestMatch.href);
  if (!categoryUrl) {
    logger.error(`[CATEGORY] Failed to normalize URL: ${bestMatch.href}`);
    return { found: true, url: page.url(), direct: true };
  }

  logger.info(`[CATEGORY] Opening category page: ${categoryUrl}`);
  await page.goto(categoryUrl, { waitUntil: 'networkidle', timeout: 60000 });
  await randomDelay(2000, 4000);

  return { found: true, url: categoryUrl, matchText: bestMatch.text, direct: false };
};

const discoverMachines = async (page, categoryUrl, website, category) => {
  const selectorAI = new SelectorAI(page);
  const allMachines = [];
  const visitedUrls = new Set();

  let currentUrl = categoryUrl;
  let hasMorePages = true;
  let pageNum = 1;

  while (hasMorePages) {
    logger.info(`[MACHINE_DISCOVERY] Scraping page ${pageNum}: ${currentUrl}`);

    if (currentUrl !== page.url()) {
      await page.goto(currentUrl, { waitUntil: 'networkidle', timeout: 60000 });
      await randomDelay(2000, 4000);
    }

    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    if (scrollHeight > 5000) {
      await page.evaluate(async () => {
        for (let i = 0; i < 5; i++) {
          window.scrollBy(0, window.innerHeight);
          await new Promise(r => setTimeout(r, 500));
        }
      });
      await randomDelay(1000, 2000);
    }

    const { items } = await selectorAI.detectMachineListings();

    for (const item of items) {
      const machineUrl = normalizeUrl(website, item.url);
      if (machineUrl && !visitedUrls.has(machineUrl)) {
        visitedUrls.add(machineUrl);
        allMachines.push({
          machine_name: item.name,
          machine_url: machineUrl,
          category,
          thumbnail_url: item.thumbnail ? normalizeUrl(website, item.thumbnail) : null,
          source_website: website,
        });
      }
    }

    logger.info(`[MACHINE_DISCOVERY] Found ${items.length} machines on page ${pageNum} (total: ${allMachines.length})`);

    const nextPage = await selectorAI.detectPagination();
    if (nextPage && nextPage.url) {
      currentUrl = normalizeUrl(website, nextPage.url);
      hasMorePages = currentUrl && currentUrl !== categoryUrl;
      pageNum++;
      await randomDelay(1500, 3000);
    } else {
      hasMorePages = false;
    }
  }

  return allMachines;
};

module.exports = { scrapeCategory, discoverMachines };

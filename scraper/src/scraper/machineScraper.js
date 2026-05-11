const logger = require('../services/logger');
const { randomDelay } = require('../utils/delay');

const extractLabelValue = async (page, labelText) => {
  return page.evaluate((label) => {
    const labelLower = label.toLowerCase();

    const dtElements = document.querySelectorAll('dt');
    for (const dt of dtElements) {
      const dtText = (dt.textContent || '').trim().toLowerCase();
      if (dtText === labelLower || dtText.includes(labelLower)) {
        const dd = dt.nextElementSibling;
        if (dd) return (dd.textContent || '').trim();
      }
    }

    const allEls = document.querySelectorAll('[class*="headline"], .label, th, label, .field-label');
    for (const el of allEls) {
      const text = (el.textContent || '').trim().toLowerCase();
      if (text === labelLower || text.includes(labelLower)) {
        const parent = el.parentElement;
        if (parent) {
          const valueEl = parent.querySelector('.value, .data, td:last-child, .field-value') || el.nextElementSibling;
          if (valueEl) return (valueEl.textContent || '').trim();
        }
      }
    }

    const allDlElements = document.querySelectorAll('dl');
    for (const dl of allDlElements) {
      const dt = dl.querySelector('dt');
      const dd = dl.querySelector('dd');
      if (dt && dd) {
        const dtText = (dt.textContent || '').trim().toLowerCase();
        if (dtText === labelLower || dtText.includes(labelLower)) {
          return (dd.textContent || '').trim();
        }
      }
    }

    return null;
  }, labelText);
};

const normalizeNumeric = (value) => {
  if (!value) return null;
  return value
    .replace(/JPY/g, '')
    .replace(/円/g, '')
    .replace(/,/g, '')
    .replace(/\s+/g, '')
    .trim();
};

const scrapeMachineDetail = async (page, machine) => {
  logger.info(`[MACHINE] Scraping details for: ${machine.machine_name}`);

  try {
    await page.goto(machine.machine_url, { waitUntil: 'networkidle', timeout: 60000 });
    await randomDelay(2000, 4000);

    const maker = await extractLabelValue(page, 'maker');
    const model = await extractLabelValue(page, 'model');
    const serialNumber = await extractLabelValue(page, 'serial');

    const yearRaw = await extractLabelValue(page, 'Year');
    const year = yearRaw ? parseInt(normalizeNumeric(yearRaw), 10) : null;

    const hourRaw = await extractLabelValue(page, 'Hour');
    const hourMeter = hourRaw ? parseInt(normalizeNumeric(hourRaw), 10) : null;

    const lotNumber = await extractLabelValue(page, 'Lot No.');

    const deliveryYard = await extractLabelValue(page, 'Delivery Yard');

    const startPriceRaw = await extractLabelValue(page, 'Start Price');
    const startPriceJpy = startPriceRaw ? parseInt(normalizeNumeric(startPriceRaw), 10) : null;

    const incrementRaw = await extractLabelValue(page, 'Increment');
    const bidIncrementJpy = incrementRaw ? parseInt(normalizeNumeric(incrementRaw), 10) : null;

    const releasingChargeRaw = await extractLabelValue(page, 'Releasing Charge');
    const releasingChargeJpy = releasingChargeRaw ? parseInt(normalizeNumeric(releasingChargeRaw), 10) : null;

    const featureComment = await extractLabelValue(page, 'Feature Comment');

    const resultModel = model || machine.machine_name;
    const resultMaker = maker || '';
    const resultLot = lotNumber || '';

    logger.info(`[MACHINE] Extracted: ${resultMaker} ${resultModel} (Lot: ${resultLot})`);

    return {
      maker: resultMaker,
      model: resultModel,
      serial_number: serialNumber || '',
      year,
      hour_meter: hourMeter,
      lot_number: resultLot,
      delivery_yard: deliveryYard || '',
      start_price_jpy: startPriceJpy,
      bid_increment_jpy: bidIncrementJpy,
      releasing_charge_jpy: releasingChargeJpy,
      feature_comment: featureComment || '',
      source_url: machine.machine_url,
      thumbnail_url: machine.thumbnail_url,
    };
  } catch (error) {
    logger.error(`[MACHINE] Failed to scrape ${machine.machine_name}`, { error: error.message });
    throw error;
  }
};

module.exports = { scrapeMachineDetail, extractLabelValue, normalizeNumeric };

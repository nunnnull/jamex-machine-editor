const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const logger = require('../services/logger');
const { ensureDir, isAllowedImage, isRejectedFile, safeJoin } = require('../utils/fileHelpers');
const { validateZipBuffer } = require('../services/validationService');

const extractImages = async (zipPath, outputDir) => {
  logger.info(`[EXTRACTOR] Extracting images from ${path.basename(zipPath)}`);

  if (!fs.existsSync(zipPath)) {
    throw new Error(`ZIP file not found: ${zipPath}`);
  }

  const zipBuffer = fs.readFileSync(zipPath);
  if (!validateZipBuffer(zipBuffer)) {
    throw new Error(`Invalid ZIP file: ${zipPath}`);
  }

  ensureDir(outputDir);

  let zip;
  try {
    zip = new AdmZip(zipPath);
  } catch (error) {
    throw new Error(`Failed to open ZIP: ${error.message}`);
  }

  const zipEntries = zip.getEntries();
  logger.debug(`[EXTRACTOR] ZIP contains ${zipEntries.length} entries`);

  const extractedImages = [];
  let rejectedCount = 0;

  for (const entry of zipEntries) {
    if (entry.isDirectory) continue;

    const entryName = entry.entryName || path.basename(entry.name);
    const ext = path.extname(entryName).toLowerCase();

    if (isRejectedFile(entryName)) {
      logger.warn(`[EXTRACTOR] Rejected unsafe file: ${entryName}`);
      rejectedCount++;
      continue;
    }

    if (!isAllowedImage(entryName)) {
      logger.debug(`[EXTRACTOR] Skipping non-image: ${entryName}`);
      continue;
    }

    try {
      const safePath = safeJoin(outputDir, path.basename(entryName));
      const buffer = entry.getData();

      if (buffer.length === 0) {
        logger.warn(`[EXTRACTOR] Skipping empty file: ${entryName}`);
        continue;
      }

      fs.writeFileSync(safePath, buffer);
      extractedImages.push(safePath);
      logger.debug(`[EXTRACTOR] Extracted: ${entryName} (${(buffer.length / 1024).toFixed(1)} KB)`);
    } catch (error) {
      logger.warn(`[EXTRACTOR] Failed to extract ${entryName}: ${error.message}`);
    }
  }

  logger.info(`[EXTRACTOR] Extracted ${extractedImages.length} images (${rejectedCount} rejected files)`);
  return extractedImages;
};

module.exports = { extractImages };

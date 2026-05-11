const { isValidUrl } = require('../utils/urlHelpers');
const path = require('path');
const logger = require('./logger');

const validateScrapeRequest = (body) => {
  const errors = [];
  if (!body.website) {
    errors.push('website is required');
  } else if (!isValidUrl(body.website)) {
    errors.push('website must be a valid URL');
  }
  return errors;
};

const validateZipBuffer = (buffer) => {
  if (!buffer || buffer.length === 0) return false;
  const zipMagic = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  const zipEmpty = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const zipSpan = Buffer.from([0x50, 0x4b, 0x07, 0x08]);
  const header = buffer.subarray(0, 4);
  return (
    header.equals(zipMagic) ||
    header.equals(zipEmpty) ||
    header.equals(zipSpan)
  );
};

const validateImageBuffer = async (sharp) => {
  try {
    const metadata = await sharp.metadata();
    return !!(metadata.format && metadata.width && metadata.height);
  } catch {
    return false;
  }
};

const validateFilePath = (filePath) => {
  const resolved = path.resolve(filePath);
  const tempDir = path.resolve('temp');
  const downloadsDir = path.resolve('downloads');
  return resolved.startsWith(tempDir) || resolved.startsWith(downloadsDir);
};

const sanitizeRequest = (body) => {
  return {
    website: body.website ? body.website.trim().replace(/[<>]/g, '') : '',
  };
};

module.exports = {
  validateScrapeRequest,
  validateZipBuffer,
  validateImageBuffer,
  validateFilePath,
  sanitizeRequest,
};

const url = require('url');

const isValidUrl = (urlString) => {
  try {
    const parsed = new URL(urlString);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const normalizeUrl = (baseUrl, relativePath) => {
  if (!relativePath) return null;
  try {
    return new URL(relativePath, baseUrl).href;
  } catch {
    return null;
  }
};

const getDomain = (urlString) => {
  try {
    const parsed = new URL(urlString);
    return parsed.hostname;
  } catch {
    return null;
  }
};

const isSameDomain = (url1, url2) => {
  return getDomain(url1) === getDomain(url2);
};

module.exports = {
  isValidUrl,
  normalizeUrl,
  getDomain,
  isSameDomain,
};

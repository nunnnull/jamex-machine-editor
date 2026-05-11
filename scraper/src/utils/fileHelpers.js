const path = require('path');
const fs = require('fs');
const config = require('../config');

const sanitizeFilename = (name) => {
  return name
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '_')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .substring(0, 200);
};

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
};

const getMachineDir = (category, machineName) => {
  const safeCategory = sanitizeFilename(category);
  const safeName = sanitizeFilename(machineName);
  return path.join(config.tempDir, safeCategory, safeName);
};

const cleanupDir = (dirPath) => {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
};

const cleanupFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

const isAllowedImage = (filename) => {
  const ext = path.extname(filename).toLowerCase().replace('.', '');
  return config.allowedImageFormats.includes(ext);
};

const isRejectedFile = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  return config.rejectedExtensions.includes(ext);
};

const safeJoin = (...paths) => {
  const resolved = path.resolve(path.join(...paths));
  const base = path.resolve(config.tempDir);
  if (!resolved.startsWith(base)) {
    throw new Error('Path traversal detected');
  }
  return resolved;
};

module.exports = {
  sanitizeFilename,
  ensureDir,
  getMachineDir,
  cleanupDir,
  cleanupFile,
  isAllowedImage,
  isRejectedFile,
  safeJoin,
};

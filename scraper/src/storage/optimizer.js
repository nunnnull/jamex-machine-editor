const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const logger = require('../services/logger');

const optimizeImage = async (inputPath, outputPath) => {
  try {
    const metadata = await sharp(inputPath).metadata();
    let pipeline = sharp(inputPath);

    if (metadata.width > 1920) {
      pipeline = pipeline.resize(1920, null, { fit: 'inside', withoutEnlargement: true });
    }
    if (metadata.height > 1920) {
      pipeline = pipeline.resize(null, 1920, { fit: 'inside', withoutEnlargement: true });
    }

    pipeline = pipeline.withMetadata({ exif: false });

    const ext = path.extname(outputPath).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') {
      pipeline = pipeline.jpeg({ quality: 85, mozjpeg: true });
    } else if (ext === '.png') {
      pipeline = pipeline.png({ compressionLevel: 8, palette: true });
    } else if (ext === '.webp') {
      pipeline = pipeline.webp({ quality: 85 });
    }

    await pipeline.toFile(outputPath);
    logger.debug(`[OPTIMIZER] Image optimized: ${path.basename(inputPath)}`);
    return true;
  } catch (error) {
    logger.error(`[OPTIMIZER] Failed to optimize image: ${inputPath}`, { error: error.message });
    return false;
  }
};

const validateImage = async (imagePath) => {
  try {
    const metadata = await sharp(imagePath).metadata();
    if (!metadata.format || !metadata.width || !metadata.height) {
      return false;
    }
    if (metadata.width < 10 || metadata.height < 10) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

const getImageFormat = async (imagePath) => {
  try {
    const metadata = await sharp(imagePath).metadata();
    return metadata.format;
  } catch {
    return null;
  }
};

module.exports = { optimizeImage, validateImage, getImageFormat };

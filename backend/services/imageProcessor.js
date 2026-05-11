import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { callPythonService, callRemoveBg } from './aiService.js';
import { updateJobMeta, getJobMeta, getJobTempDir } from '../storage/tempStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_DIR = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'storage');
const TEMP_DIR = path.join(STORAGE_DIR, 'temp');
const PROCESSED_DIR = path.join(STORAGE_DIR, 'processed');

const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY;

function getImageOriginalFilename(jobId) {
  const metaPath = path.join(STORAGE_DIR, 'meta', `${jobId}.json`);
  return metaPath;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function getProcessedDir(jobId) {
  return path.join(PROCESSED_DIR, jobId);
}

async function mockRemoveBackground(imagePath, outputPath) {
  try {
    const { width, height } = await sharp(imagePath).metadata();
    if (!width || !height) throw new Error('Invalid image dimensions');

    const blurred = await sharp(imagePath)
      .blur(40)
      .jpeg({ quality: 30 })
      .toBuffer();

    const raw = await sharp(imagePath)
      .ensureAlpha()
      .raw()
      .toBuffer();

    const mask = Buffer.alloc(raw.length);
    const channels = 4;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * channels;
        const r = raw[i], g = raw[i + 1], b = raw[i + 2];
        const isEdge = x < 15 || x >= width - 15 || y < 15 || y >= height - 15;
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114);

        if (isEdge || brightness > 230) {
          mask[i] = 0; mask[i + 1] = 0; mask[i + 2] = 0; mask[i + 3] = 0;
        } else {
          mask[i] = 255; mask[i + 1] = 255; mask[i + 2] = 255; mask[i + 3] = 255;
        }
      }
    }

    const blurredResized = await sharp(blurred)
      .resize(width, height)
      .ensureAlpha()
      .raw()
      .toBuffer();

    const output = Buffer.alloc(raw.length);
    for (let i = 0; i < raw.length; i += channels) {
      const alpha = mask[i + 3] / 255;
      output[i] = Math.round(raw[i] * alpha + blurredResized[i] * (1 - alpha));
      output[i + 1] = Math.round(raw[i + 1] * alpha + blurredResized[i + 1] * (1 - alpha));
      output[i + 2] = Math.round(raw[i + 2] * alpha + blurredResized[i + 2] * (1 - alpha));
      output[i + 3] = 255;
    }

    await sharp(output, { raw: { width, height, channels: 4 } })
      .png()
      .toFile(outputPath);
  } catch (err) {
    console.error('[mockRemoveBackground] Error:', err.message);
    throw err;
  }
}

export async function processImage(jobId, imageId, originalFilename) {
  const tempDir = getJobTempDir(jobId);
  const imagePath = path.join(tempDir, originalFilename);
  const processedDir = getProcessedDir(jobId);
  await ensureDir(processedDir);

  console.log(`[processImage] Starting jobId=${jobId} imageId=${imageId} file=${originalFilename}`);
  console.log(`[processImage] Looking for file at: ${imagePath}`);

  try {
    await fs.access(imagePath);
  } catch {
    throw new Error(`Uploaded file not found at ${imagePath}`);
  }

  try {
    await sharp(imagePath).metadata();
  } catch {
    throw new Error(`Uploaded file is corrupt or not a valid image: ${originalFilename}`);
  }

  const outputFilename = `${imageId}.png`;
  const outputPath = path.join(processedDir, outputFilename);

  try {
    const currentMeta = await getJobMeta(jobId);
    const currentImg = currentMeta?.images?.[imageId];
    if (currentImg?.status === 'completed' || currentImg?.status === 'failed') {
      console.log(`[processImage] Skipping ${imageId}: already ${currentImg.status}`);
      return { success: true, imageId, outputPath: currentImg.outputPath };
    }

    await updateJobMeta(jobId, {
      status: 'processing',
      images: { [imageId]: { id: imageId, filename: originalFilename, status: 'processing' } },
    });

    let processedBuffer;
    const aiServiceUrl = process.env.AI_SERVICE_URL;
    const removeBgKey = REMOVE_BG_API_KEY;

    if (aiServiceUrl) {
      let aiReachable = false;
      try {
        const baseUrl = aiServiceUrl.replace(/\/remove-bg\/?$/, '').replace(/\/+$/, '');
        const resp = await fetch(baseUrl, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
        aiReachable = resp.ok;
      } catch {
        aiReachable = false;
      }

      if (!aiReachable) {
        console.warn(`[processImage] AI service at ${aiServiceUrl} not reachable, using mock`);
        await mockRemoveBackground(imagePath, outputPath);
      } else {
        try {
          processedBuffer = await callPythonService(imagePath, 'blur', 'medium', 'gaussian');
          await fs.writeFile(outputPath, processedBuffer);
        } catch (aiErr) {
          console.warn(`[processImage] AI service error (${aiErr.message}), falling back to mock`);
          await mockRemoveBackground(imagePath, outputPath);
        }
      }
    } else if (removeBgKey) {
      try {
        processedBuffer = await callRemoveBg(imagePath, removeBgKey);
        await sharp(processedBuffer).png().toFile(outputPath);
      } catch (apiErr) {
        console.warn(`[processImage] remove.bg API failed (${apiErr.message}), falling back to mock`);
        await mockRemoveBackground(imagePath, outputPath);
      }
    } else {
      await mockRemoveBackground(imagePath, outputPath);
    }

    const merged = await updateJobMeta(jobId, {
      images: { [imageId]: { id: imageId, filename: originalFilename, status: 'completed', outputPath } },
    });

    const allImgs = Object.values(merged.images || {});
    const allDone = allImgs.length > 0 && allImgs.every(i => i.status === 'completed' || i.status === 'failed');
    if (allDone) {
      const anyFailed = allImgs.some(i => i.status === 'failed');
      await updateJobMeta(jobId, { status: anyFailed ? 'completed_with_errors' : 'completed' });
    }

    console.log(`[processImage] Completed jobId=${jobId} imageId=${imageId} -> ${outputPath}`);
    return { success: true, imageId, outputPath };
  } catch (err) {
    console.error(`[processImage] Error processing ${originalFilename}:`, err.message);

    try {
      const merged = await updateJobMeta(jobId, {
        images: { [imageId]: { id: imageId, filename: originalFilename, status: 'failed', error: err.message } },
      });
      const allImgs = Object.values(merged.images || {});
      const allDone = allImgs.length > 0 && allImgs.every(i => i.status === 'completed' || i.status === 'failed');
      if (allDone) {
        await updateJobMeta(jobId, { status: 'completed_with_errors' });
      }
    } catch (metaErr) {
      console.error(`[processImage] Failed to update error status:`, metaErr.message);
    }

    throw err;
  }
}

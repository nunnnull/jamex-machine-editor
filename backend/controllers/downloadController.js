import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getJobMeta, getJobProcessedFiles } from '../storage/tempStore.js';
import { generateZip } from '../services/zipService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_DIR = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'storage');
const PROCESSED_DIR = path.join(STORAGE_DIR, 'processed');

function getProcessedDir(jobId) {
  return path.join(PROCESSED_DIR, jobId);
}

export async function handleDownloadAll(req, res, next) {
  try {
    const { jobId } = req.params;
    const selectedStr = req.query.selected;
    const selectedIds = selectedStr ? selectedStr.split(',').filter(Boolean) : null;

    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json({ error: 'Invalid job ID.', code: 400 });
    }

    const meta = await getJobMeta(jobId);
    if (!meta) {
      return res.status(404).json({ error: 'Job not found.', code: 404 });
    }

    const { stream, filename } = await generateZip(jobId, selectedIds);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    stream.on('error', (err) => {
      console.error('[downloadAll] Stream error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to generate ZIP file.', code: 500 });
      } else {
        res.end();
      }
    });

    stream.pipe(res);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, code: err.statusCode });
    }
    next(err);
  }
}

export async function handleDownloadSingle(req, res, next) {
  try {
    const { jobId, imageId } = req.params;

    if (!jobId || !imageId) {
      return res.status(400).json({ error: 'Invalid job ID or image ID.', code: 400 });
    }

    const meta = await getJobMeta(jobId);
    if (!meta) {
      return res.status(404).json({ error: 'Job not found.', code: 404 });
    }

    const processedDir = getProcessedDir(jobId);
    const imagePath = path.join(processedDir, `${imageId}.png`);

    try {
      await fs.access(imagePath);
    } catch {
      return res.status(404).json({ error: 'Processed image not found.', code: 404 });
    }

    const images = meta.images || {};
    const imageMeta = images[imageId];
    const originalName = imageMeta?.originalname || imageMeta?.filename || 'image';
    const baseName = path.parse(originalName).name;
    const downloadName = `${baseName}-no-bg.png`;

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);

    const readStream = fs.createReadStream(imagePath);
    readStream.on('error', (err) => {
      console.error('[downloadSingle] Stream error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream image.', code: 500 });
      } else {
        res.end();
      }
    });

    readStream.pipe(res);
  } catch (err) {
    next(err);
  }
}

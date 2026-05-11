import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import { getJobProcessedFiles } from '../storage/tempStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_DIR = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'storage');
const PROCESSED_DIR = path.join(STORAGE_DIR, 'processed');

function getProcessedDir(jobId) {
  return path.join(PROCESSED_DIR, jobId);
}

function formatDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function generateZip(jobId, selectedIds = null) {
  const processedDir = getProcessedDir(jobId);

  try {
    await fs.access(processedDir);
  } catch {
    throw Object.assign(new Error('No processed images found for this job'), { statusCode: 404 });
  }

  let files = await getJobProcessedFiles(jobId);

  if (selectedIds && selectedIds.length > 0) {
    const selectedSet = new Set(selectedIds);
    files = files.filter(f => {
      const id = path.parse(f.name).name;
      return selectedSet.has(id);
    });
  }

  if (files.length === 0) {
    throw Object.assign(new Error('No processed images found for this job'), { statusCode: 404 });
  }

  const archive = archiver('zip', {
    zlib: { level: 9 },
  });

  const dateStr = formatDate();
  const zipFilename = `machinery-background-removed-${dateStr}.zip`;

  for (const file of files) {
    archive.file(file.path, { name: file.name });
  }

  archive.finalize();

  return { stream: archive, filename: zipFilename };
}

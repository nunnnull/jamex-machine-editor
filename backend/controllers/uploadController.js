import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { saveFile, updateJobMeta, getJobFolder } from '../storage/tempStore.js';
import { validateImageType, validateImageSize, sanitizeFilename } from '../middleware/validation.js';
import { processImage } from '../services/imageProcessor.js';
import processingQueue from '../queues/processingQueue.js';

const ALLOWED_IMG_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'application/zip', 'application/x-zip-compressed',
]);

function isZipFile(mimetype, filename) {
  if (mimetype === 'application/zip' || mimetype === 'application/x-zip-compressed') return true;
  if (filename && (filename.endsWith('.zip') || filename.endsWith('.ZIP'))) return true;
  return false;
}

async function extractZipImages(filePath) {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();
  const images = [];
  const imgExts = new Set(['.jpg', '.jpeg', '.png', '.webp']);

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const ext = path.extname(entry.entryName).toLowerCase();
    if (!imgExts.has(ext)) continue;
    const data = entry.getData();
    if (data.length > 25 * 1024 * 1024) {
      console.warn(`[upload] Skipping ${entry.entryName} in ZIP: exceeds 25MB`);
      continue;
    }
    const name = path.basename(entry.entryName);
    images.push({ data, name, size: data.length });
  }
  return images;
}

export async function handleUpload(req, res, next) {
  try {
    const files = req.files;
    const isZipUpload = files.length === 1 && isZipFile(files[0].mimetype, files[0].originalname);

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded. Use field name "images".', code: 400 });
    }

    const jobId = uuidv4();
    const processedFiles = [];
    const filenameCounts = new Map();

    if (isZipUpload) {
      const zipFile = files[0];
      const extracted = await extractZipImages(zipFile.path);
      if (extracted.length === 0) {
        return res.status(400).json({ error: 'No valid image files found in ZIP.', code: 400 });
      }
      for (const img of extracted) {
        let originalName = sanitizeFilename(img.name);
        const count = filenameCounts.get(originalName) || 0;
        if (count > 0) {
          const dotIdx = originalName.lastIndexOf('.');
          originalName = dotIdx > 0
            ? originalName.slice(0, dotIdx) + `_${count}` + originalName.slice(dotIdx)
            : originalName + `_${count}`;
        }
        filenameCounts.set(sanitizeFilename(img.name), count + 1);

        const tempPath = path.join('/tmp/uploads', `${uuidv4()}_${originalName}`);
        await fs.writeFile(tempPath, img.data);
        const fakeFile = {
          filename: originalName,
          originalname: img.name,
          path: tempPath,
          size: img.size,
          mimetype: `image/${path.extname(img.name).slice(1)}`,
        };
        await saveFile(fakeFile, jobId);
        processedFiles.push(fakeFile);
      }
      await fs.unlink(zipFile.path).catch(() => {});
    } else {
      for (const file of files) {
        try {
          if (!ALLOWED_IMG_TYPES.has(file.mimetype) && !isZipFile(file.mimetype, file.originalname)) {
            throw Object.assign(new Error(`Invalid file type: ${file.mimetype}`), { code: 'INVALID_FILE_TYPE' });
          }
          if (isZipFile(file.mimetype, file.originalname)) {
            console.warn(`[upload] Skipping ZIP file in multi-file upload: ${file.originalname}`);
            continue;
          }
          validateImageSize(file.size);

          let originalName = sanitizeFilename(file.originalname);
          const count = filenameCounts.get(originalName) || 0;
          if (count > 0) {
            const dotIdx = originalName.lastIndexOf('.');
            originalName = dotIdx > 0
              ? originalName.slice(0, dotIdx) + `_${count}` + originalName.slice(dotIdx)
              : originalName + `_${count}`;
          }
          filenameCounts.set(sanitizeFilename(file.originalname), count + 1);
          file.filename = originalName;

          await saveFile(file, jobId);
          processedFiles.push(file);
        } catch (err) {
          if (err.code === 'INVALID_FILE_TYPE' || err.code === 'FILE_TOO_LARGE') {
            console.error(`[upload] Skipping file ${file.originalname}: ${err.message}`);
            continue;
          }
          throw err;
        }
      }
    }

    if (processedFiles.length === 0) {
      return res.status(400).json({
        error: 'No valid files were uploaded. Accepted types: jpg, jpeg, png, webp (max 25MB each).',
        code: 400,
      });
    }

    const imageMeta = {};
    for (const file of processedFiles) {
      const imageId = uuidv4();
      imageMeta[imageId] = {
        id: imageId,
        filename: file.filename,
        originalname: file.originalname,
        status: 'queued',
      };
    }

    await updateJobMeta(jobId, {
      jobId,
      status: 'queued',
      total: processedFiles.length,
      completed: 0,
      failed: 0,
      processing: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      images: imageMeta,
    });

    for (const [imageId, meta] of Object.entries(imageMeta)) {
      processingQueue.addJob(async () => {
        await processImage(jobId, imageId, meta.filename);
      }).catch(err => {
        console.error(`[uploadController] Job failed for ${imageId}:`, err.message);
      });
    }

    return res.status(200).json({
      jobId,
      uploaded: processedFiles.length,
    });
  } catch (err) {
    next(err);
  }
}

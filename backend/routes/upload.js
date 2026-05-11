import { Router } from 'express';
import multer from 'multer';
import { handleUpload } from '../controllers/uploadController.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';

const upload = multer({
  dest: '/tmp/uploads',
  limits: {
    fileSize: 500 * 1024 * 1024,
    files: 50,
  },
});

const router = Router();

router.post(
  '/',
  uploadLimiter,
  upload.array('images', 50),
  handleUpload
);

export default router;

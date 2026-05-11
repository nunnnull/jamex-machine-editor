import { Router } from 'express';
import { handleDownloadAll, handleDownloadSingle } from '../controllers/downloadController.js';
import { downloadLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.get('/:jobId', downloadLimiter, handleDownloadAll);
router.get('/:jobId/:imageId', downloadLimiter, handleDownloadSingle);

export default router;

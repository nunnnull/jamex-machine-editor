import { Router } from 'express';
import { handleStatus } from '../controllers/statusController.js';
import { statusLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.get('/:jobId', statusLimiter, handleStatus);

export default router;

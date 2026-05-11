import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import uploadRoutes from './routes/upload.js';
import statusRoutes from './routes/status.js';
import downloadRoutes from './routes/download.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { cleanupOldJobs } from './storage/tempStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;
const STORAGE_DIR = path.join(__dirname, process.env.UPLOAD_DIR || 'storage');

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use('/processed', express.static(path.join(STORAGE_DIR, 'processed'), {
  maxAge: '1h',
  immutable: true,
}));

app.use('/api/upload', uploadRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/download', downloadRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(notFoundHandler);
app.use(errorHandler);

setInterval(() => {
  cleanupOldJobs().catch(err => {
    console.error('[cleanup] Error during job cleanup:', err.message);
  });
}, 60 * 60 * 1000);

cleanupOldJobs().catch(err => {
  console.error('[cleanup] Initial cleanup error:', err.message);
});

app.listen(PORT, () => {
  console.log(`[server] Machinery BG Remover backend running on port ${PORT}`);
  console.log(`[server] Storage directory: ${STORAGE_DIR}`);
});

export default app;

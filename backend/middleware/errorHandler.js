import { MulterError } from 'multer';

export function errorHandler(err, req, res, _next) {
  const timestamp = new Date().toISOString();

  if (err instanceof MulterError) {
    console.error(`[${timestamp}] Multer error:`, err.message);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 25MB.', code: 400 });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Unexpected file field. Use "images".', code: 400 });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Maximum is 50 per request.', code: 400 });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}`, code: 400 });
  }

  if (err.statusCode) {
    console.error(`[${timestamp}] Application error:`, err.message);
    return res.status(err.statusCode).json({ error: err.message, code: err.statusCode });
  }

  console.error(`[${timestamp}] Unhandled error:`, err);
  return res.status(500).json({
    error: 'Internal server error. Please try again later.',
    code: 500,
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found`, code: 404 });
}

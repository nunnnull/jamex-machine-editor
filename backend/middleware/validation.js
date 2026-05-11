const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const MAX_SIZE = 25 * 1024 * 1024;

const TRAVERSAL_PATTERN = /[/]\.\.\//g;
const SPECIAL_CHARS = /[^a-zA-Z0-9._-]/g;

export function validateImageType(mimetype) {
  if (!mimetype || !ALLOWED_TYPES.has(mimetype)) {
    const err = new Error(`Invalid file type: ${mimetype}. Allowed: jpg, jpeg, png, webp`);
    err.statusCode = 400;
    err.code = 'INVALID_FILE_TYPE';
    throw err;
  }
  return true;
}

export function validateImageSize(size) {
  if (!size || size > MAX_SIZE) {
    const err = new Error(`File size exceeds maximum of 25MB`);
    err.statusCode = 400;
    err.code = 'FILE_TOO_LARGE';
    throw err;
  }
  return true;
}

export function sanitizeFilename(name) {
  if (!name) return `file_${Date.now()}`;

  let sanitized = name.replace(TRAVERSAL_PATTERN, '');
  sanitized = sanitized.split('/').pop().split('\\').pop();
  sanitized = sanitized.replace(SPECIAL_CHARS, '_');
  sanitized = sanitized.substring(0, 255);

  if (!sanitized || sanitized === '.') {
    sanitized = `file_${Date.now()}`;
  }

  return sanitized;
}

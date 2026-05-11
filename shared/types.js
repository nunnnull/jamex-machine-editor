export const IMAGE_STATUS = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
}

export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']
export const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB
export const MAX_BATCH_SIZE = 500
export const DEFAULT_CONCURRENCY = 3
export const PROCESSING_TIMEOUT = 30000

export function isValidImageType(mimetype) {
  return ALLOWED_TYPES.includes(mimetype)
}

export function isValidExtension(filename) {
  const ext = '.' + filename.split('.').pop().toLowerCase()
  return ALLOWED_EXTENSIONS.includes(ext)
}

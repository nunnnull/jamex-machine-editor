const { getSupabase } = require('../database/supabase');
const fs = require('fs');
const path = require('path');
const logger = require('../services/logger');
const { retry } = require('../services/retryService');
const config = require('../config');

const uploadZipToSupabase = async (filePath, storagePath) => {
  const supabase = getSupabase();
  if (!supabase) {
    logger.warn('[UPLOADER] Supabase not configured. Skipping upload.');
    return { publicUrl: `mock://${storagePath}`, storagePath };
  }

  return retry(async () => {
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const fullPath = `${storagePath}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('machine-photos')
      .upload(fullPath, fileBuffer, {
        contentType: 'application/zip',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Supabase upload failed: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('machine-photos')
      .getPublicUrl(fullPath);

    logger.info(`[UPLOADER] ZIP uploaded: ${fullPath}`);
    return { publicUrl, storagePath: fullPath };
  }, {
    maxRetries: config.maxRetries,
    context: `Upload ZIP ${fileName}`,
  });
};

module.exports = { uploadZipToSupabase };

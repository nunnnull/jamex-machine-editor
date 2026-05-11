const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const logger = require('../services/logger');

let supabase = null;

const getSupabase = () => {
  if (!supabase) {
    if (!config.supabaseUrl || !config.supabaseKey) {
      logger.warn('Supabase credentials not configured. Database features will be disabled.');
      return null;
    }
    supabase = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: { persistSession: false }
    });
  }
  return supabase;
};

module.exports = { getSupabase };

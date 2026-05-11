const { getSupabase } = require('./supabase');
const logger = require('../services/logger');

const queries = {
  async createScrapeJob({ website }) {
    const supabase = getSupabase();
    if (!supabase) return { id: 'local-' + Date.now() };
    const { data, error } = await supabase
      .from('scrape_jobs')
      .insert({ website, status: 'pending' })
      .select('id')
      .single();
    if (error) {
      logger.error('[DB] Failed to create scrape job', { error: error.message });
      throw error;
    }
    return data;
  },

  async updateJobStatus(id, updates) {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase
      .from('scrape_jobs')
      .update(updates)
      .eq('id', id);
    if (error) logger.error('[DB] Failed to update job', { error: error.message });
  },

  async getJob(id) {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('scrape_jobs')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  },

  async getJobs() {
    const supabase = getSupabase();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('scrape_jobs')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return [];
    return data;
  },

  async upsertAuction(data) {
    const supabase = getSupabase();
    if (!supabase) {
      logger.warn('[DB] Supabase not configured, skipping DB write');
      return { id: 'local-' + Date.now() };
    }

    const record = {
      maker: data.maker,
      model: data.model,
      serial_number: data.serial_number,
      year: data.year,
      hour_meter: data.hour_meter,
      lot_number: data.lot_number,
      delivery_yard: data.delivery_yard,
      start_price_jpy: data.start_price_jpy,
      bid_increment_jpy: data.bid_increment_jpy,
      releasing_charge_jpy: data.releasing_charge_jpy,
      feature_comment: data.feature_comment,
      source_url: data.source_url,
      zip_file_name: data.zip_file_name,
      zip_file_size: data.zip_file_size,
      zip_storage_path: data.zip_storage_path,
      zip_public_url: data.zip_public_url,
      zip_downloaded_at: data.zip_downloaded_at,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from('jen_auctions')
      .select('id')
      .eq('lot_number', data.lot_number)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('jen_auctions')
        .update(record)
        .eq('id', existing.id);
      if (error) {
        logger.error('[DB] Failed to update auction', { error: error.message });
        throw error;
      }
      logger.info(`[DB] Updated auction: ${data.lot_number}`);
      return { id: existing.id, updated: true };
    }

    const { error } = await supabase
      .from('jen_auctions')
      .insert(record)
      .select('id')
      .single();
    if (error) {
      logger.error('[DB] Failed to insert auction', { error: error.message });
      throw error;
    }
    logger.info(`[DB] Inserted auction: ${data.lot_number}`);
    return { id: data.id, updated: false };
  },

  async getAuctions({ limit = 50, offset = 0 } = {}) {
    const supabase = getSupabase();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('jen_auctions')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) return [];
    return data;
  },

  async getAuctionById(id) {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('jen_auctions')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  },

  async getAuctionByLotNumber(lotNumber) {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('jen_auctions')
      .select('id, zip_storage_path, zip_public_url')
      .eq('lot_number', lotNumber)
      .maybeSingle();
    if (error) return null;
    return data;
  },

  async incrementJobProcessed(jobId) {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: job } = await supabase
      .from('scrape_jobs')
      .select('processed_items')
      .eq('id', jobId)
      .single();
    if (job) {
      await supabase
        .from('scrape_jobs')
        .update({ processed_items: (job.processed_items || 0) + 1 })
        .eq('id', jobId);
    }
  },

  async incrementJobFailed(jobId) {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: job } = await supabase
      .from('scrape_jobs')
      .select('failed_items')
      .eq('id', jobId)
      .single();
    if (job) {
      await supabase
        .from('scrape_jobs')
        .update({ failed_items: (job.failed_items || 0) + 1 })
        .eq('id', jobId);
    }
  },
};

module.exports = queries;

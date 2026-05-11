CREATE TABLE IF NOT EXISTS jen_auctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maker TEXT,
    model TEXT,
    serial_number TEXT,
    year INTEGER,
    hour_meter INTEGER,
    lot_number TEXT UNIQUE,
    delivery_yard TEXT,
    start_price_jpy BIGINT,
    bid_increment_jpy BIGINT,
    releasing_charge_jpy BIGINT,
    feature_comment TEXT,
    source_url TEXT,
    zip_file_name TEXT,
    zip_file_size BIGINT,
    zip_storage_path TEXT,
    zip_public_url TEXT,
    zip_downloaded_at TIMESTAMPTZ,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scrape_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website TEXT,
    status TEXT DEFAULT 'pending',
    total_items INTEGER DEFAULT 0,
    processed_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jen_auctions_lot_number ON jen_auctions(lot_number);
CREATE INDEX IF NOT EXISTS idx_jen_auctions_model ON jen_auctions(model);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON scrape_jobs(status);

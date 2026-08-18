const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'prospects.db');

// Ensure data directory exists
const fs = require('fs');
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS businesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    niche TEXT NOT NULL,
    area TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    website TEXT,
    rating REAL,
    review_count INTEGER DEFAULT 0,
    source TEXT NOT NULL, -- 'sos' or 'google'
    source_id TEXT,
    has_site INTEGER DEFAULT 0,
    site_works_on_phone INTEGER DEFAULT 0,
    last_touched TEXT,
    hours_on_page INTEGER DEFAULT 0,
    phone_on_page INTEGER DEFAULT 0,
    address_on_page INTEGER DEFAULT 0,
    owner_run INTEGER DEFAULT 1,
    last_review_reply TEXT,
    has_contact_form INTEGER DEFAULT 0,
    contact_form_fields TEXT,
    score INTEGER DEFAULT 0,
    worst_thing TEXT,
    status TEXT DEFAULT 'unscored', -- unscored, scored, filtered, built, outreach_pending, outreach_sent, converted
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    template TEXT NOT NULL,
    local_path TEXT,
    deploy_url TEXT,
    subdomain TEXT,
    paid INTEGER DEFAULT 0,
    live INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (business_id) REFERENCES businesses(id)
  );

  CREATE TABLE IF NOT EXISTS outreach (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    channel TEXT NOT NULL, -- 'form' or 'postcard'
    status TEXT DEFAULT 'pending', -- pending, approved, sent
    content TEXT,
    postcard_path TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (business_id) REFERENCES businesses(id)
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    customer_name TEXT,
    customer_email TEXT,
    image_sent INTEGER DEFAULT 0,
    review_link_sent INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (business_id) REFERENCES businesses(id)
  );

  CREATE TABLE IF NOT EXISTS client_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    email_from TEXT,
    request_text TEXT,
    fields_changed TEXT,
    status TEXT DEFAULT 'pending', -- pending, applied, needs_clarification
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (business_id) REFERENCES businesses(id)
  );

  CREATE INDEX IF NOT EXISTS idx_businesses_niche_area ON businesses(niche, area);
  CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses(status);
  CREATE INDEX IF NOT EXISTS idx_businesses_score ON businesses(score DESC);

  CREATE TABLE IF NOT EXISTS competitor_facts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company TEXT NOT NULL,
    product TEXT,
    category TEXT NOT NULL,
    claim TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    source TEXT NOT NULL,
    source_url TEXT,
    checked_at TEXT NOT NULL DEFAULT (datetime('now')),
    previous_id INTEGER,
    decision_owner TEXT,
    suggested_response TEXT,
    FOREIGN KEY (previous_id) REFERENCES competitor_facts(id)
  );
  CREATE INDEX IF NOT EXISTS idx_competitor_facts_company ON competitor_facts(company);
  CREATE INDEX IF NOT EXISTS idx_competitor_facts_status ON competitor_facts(status);
  CREATE INDEX IF NOT EXISTS idx_competitor_facts_category ON competitor_facts(category);

  CREATE TABLE IF NOT EXISTS customer_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT NOT NULL,
    source_ref TEXT,
    segment TEXT,
    signal_type TEXT NOT NULL,
    signal_text TEXT NOT NULL,
    direction TEXT NOT NULL DEFAULT 'new',
    evidence_count INTEGER DEFAULT 1,
    reviewed INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_customer_signals_segment ON customer_signals(segment);
  CREATE INDEX IF NOT EXISTS idx_customer_signals_type ON customer_signals(signal_type);
  CREATE INDEX IF NOT EXISTS idx_customer_signals_direction ON customer_signals(direction);
`);

module.exports = db;

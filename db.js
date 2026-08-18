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
`);

module.exports = db;

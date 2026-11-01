'use strict';

// SQLite database layer using better-sqlite3 (synchronous, zero external server).
// This file owns the connection, creates the schema on first run, and seeds the
// default admin account plus a few sample evacuation centres.

const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const config = require('./config');

// Make sure the data/ folder exists before opening the file.
if (!fs.existsSync(config.dataDir)) {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL'); // better concurrency for a small web app
db.pragma('foreign_keys = ON');

// --- Schema -----------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'resident'
                   CHECK (role IN ('admin', 'resident')),
    address       TEXT,
    lat           REAL,
    lng           REAL,
    alerts_opt_in INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS incident_reports (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        TEXT    NOT NULL
                 CHECK (type IN ('flood','landslide','fire','earthquake','typhoon','medical','other')),
    title       TEXT    NOT NULL,
    description TEXT,
    address     TEXT,
    lat         REAL,
    lng         REAL,
    severity    TEXT    NOT NULL DEFAULT 'medium'
                 CHECK (severity IN ('low','medium','high')),
    status      TEXT    NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','verified','resolved')),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS evacuation_centers (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    address    TEXT,
    lat        REAL    NOT NULL,
    lng        REAL    NOT NULL,
    capacity   INTEGER NOT NULL DEFAULT 0,
    contact    TEXT,
    status     TEXT    NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','full','closed')),
    notes      TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS alert_broadcasts (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    title            TEXT    NOT NULL,
    message          TEXT    NOT NULL,
    recipients_count INTEGER NOT NULL DEFAULT 0,
    preview_url      TEXT,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// --- Seed -------------------------------------------------------------------
function seed() {
  const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (userCount === 0) {
    const hash = bcrypt.hashSync(config.admin.password, 10);
    db.prepare(
      `INSERT INTO users (name, email, password_hash, role, address, lat, lng)
       VALUES (?, ?, ?, 'admin', ?, ?, ?)`
    ).run(
      config.admin.name,
      config.admin.email,
      hash,
      config.defaultPlace,
      config.defaultLat,
      config.defaultLng
    );
    console.log(`[db] Seeded admin account: ${config.admin.email}`);
  }

  const centerCount = db.prepare('SELECT COUNT(*) AS n FROM evacuation_centers').get().n;
  if (centerCount === 0) {
    const insert = db.prepare(
      `INSERT INTO evacuation_centers (name, address, lat, lng, capacity, contact, status, notes)
       VALUES (@name, @address, @lat, @lng, @capacity, @contact, @status, @notes)`
    );
    const samples = [
      {
        name: 'Manila City Hall Evacuation Center',
        address: 'Padre Burgos Ave, Ermita, Manila',
        lat: 14.5906, lng: 120.9817, capacity: 500,
        contact: '(02) 8527-0000', status: 'open',
        notes: 'Ground floor open for families. Medical team on standby.',
      },
      {
        name: 'Quezon City Hall Covered Court',
        address: 'Elliptical Road, Diliman, Quezon City',
        lat: 14.6464, lng: 121.0500, capacity: 800,
        contact: '(02) 8988-4242', status: 'open',
        notes: 'Pet-friendly area available at the rear.',
      },
      {
        name: 'Marikina Sports Center',
        address: 'Sumulong Highway, Marikina City',
        lat: 14.6377, lng: 121.1004, capacity: 1200,
        contact: '(02) 8646-1631', status: 'open',
        notes: 'Primary center for flood-prone riverside barangays.',
      },
    ];
    const tx = db.transaction((rows) => rows.forEach((r) => insert.run(r)));
    tx(samples);
    console.log(`[db] Seeded ${samples.length} sample evacuation centers.`);
  }
}

seed();

module.exports = db;

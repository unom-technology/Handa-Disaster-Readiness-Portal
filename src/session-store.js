'use strict';

// A small, dependency-free express-session store backed by our existing
// better-sqlite3 connection. Sessions persist across server restarts and expired
// rows are pruned periodically.

const session = require('express-session');
const db = require('./db');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    sid     TEXT PRIMARY KEY,
    data    TEXT NOT NULL,
    expires INTEGER NOT NULL
  );
`);

const Store = session.Store;

class SqliteStore extends Store {
  constructor() {
    super();
    this.getStmt = db.prepare('SELECT data, expires FROM sessions WHERE sid = ?');
    this.setStmt = db.prepare(
      `INSERT INTO sessions (sid, data, expires) VALUES (?, ?, ?)
       ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires = excluded.expires`
    );
    this.delStmt = db.prepare('DELETE FROM sessions WHERE sid = ?');
    this.touchStmt = db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?');
    this.pruneStmt = db.prepare('DELETE FROM sessions WHERE expires < ?');

    // Prune expired sessions every 15 minutes.
    this.timer = setInterval(() => this.prune(), 15 * 60 * 1000);
    this.timer.unref();
  }

  prune() {
    try { this.pruneStmt.run(Date.now()); } catch (_) { /* ignore */ }
  }

  // expires timestamp (ms) for a session, defaulting to 7 days.
  _expiry(sess) {
    const maxAge = sess && sess.cookie && sess.cookie.maxAge;
    return Date.now() + (maxAge || 7 * 24 * 60 * 60 * 1000);
  }

  get(sid, cb) {
    try {
      const row = this.getStmt.get(sid);
      if (!row) return cb(null, null);
      if (row.expires < Date.now()) {
        this.delStmt.run(sid);
        return cb(null, null);
      }
      return cb(null, JSON.parse(row.data));
    } catch (err) {
      return cb(err);
    }
  }

  set(sid, sess, cb) {
    try {
      this.setStmt.run(sid, JSON.stringify(sess), this._expiry(sess));
      return cb && cb(null);
    } catch (err) {
      return cb && cb(err);
    }
  }

  destroy(sid, cb) {
    try {
      this.delStmt.run(sid);
      return cb && cb(null);
    } catch (err) {
      return cb && cb(err);
    }
  }

  touch(sid, sess, cb) {
    try {
      this.touchStmt.run(this._expiry(sess), sid);
      return cb && cb(null);
    } catch (err) {
      return cb && cb(err);
    }
  }
}

module.exports = SqliteStore;

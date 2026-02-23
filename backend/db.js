const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'analytics.db');

let db;

function getDb() {
  if (!db) {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Database connection error:', err.message);
      } else {
        console.log('Connected to SQLite database');
      }
    });

    db.serialize(() => {
      db.run('PRAGMA journal_mode = WAL');
      db.run('PRAGMA foreign_keys = ON');
      initSchema();
    });
  }

  return db;
}

function initSchema() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        age INTEGER NOT NULL,
        gender TEXT NOT NULL CHECK(gender IN ('Male', 'Female', 'Other'))
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS feature_clicks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        feature_name TEXT NOT NULL,
        timestamp DATETIME NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_feature_clicks_user_id
      ON feature_clicks(user_id)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_feature_clicks_timestamp
      ON feature_clicks(timestamp)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_feature_clicks_feature_name
      ON feature_clicks(feature_name)
    `);
  });
}

module.exports = { getDb };

/**
 * Seed Script: Populates the database with 5 demo users and ~200 feature clicks
 * Run with: npm run seed
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getDb } = require('./db');

const FEATURES = [
  'date_filter',
  'age_filter',
  'gender_filter',
  'bar_chart_click',
  'bar_chart_zoom',
  'line_chart_hover',
  'dashboard_refresh',
];

const USERS = [
  { username: 'alice', password: 'password123', age: 25, gender: 'Female' },
  { username: 'bob', password: 'password123', age: 35, gender: 'Male' },
  { username: 'charlie', password: 'password123', age: 16, gender: 'Male' },
  { username: 'diana', password: 'password123', age: 52, gender: 'Female' },
  { username: 'evan', password: 'password123', age: 29, gender: 'Other' },
];

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(daysBack) {
  const now = new Date();
  const past = new Date(now.getTime() - daysBack * 86400000);
  const randomTime = past.getTime() + Math.random() * (now.getTime() - past.getTime());
  return new Date(randomTime).toISOString().replace('T', ' ').substring(0, 19);
}

function randomFeature() {
  const weights = [30, 20, 15, 15, 8, 7, 5];
  const total = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  for (let i = 0; i < FEATURES.length; i += 1) {
    rand -= weights[i];
    if (rand <= 0) return FEATURES[i];
  }
  return FEATURES[0];
}

async function seed() {
  const db = getDb();

  console.log('Starting seed...');

  try {
    await run(db, 'BEGIN TRANSACTION');

    const userIds = [];

    for (const u of USERS) {
      const hashed = bcrypt.hashSync(u.password, 10);

      await run(
        db,
        `INSERT OR IGNORE INTO users (username, password, age, gender)
         VALUES (?, ?, ?, ?)`,
        [u.username, hashed, u.age, u.gender]
      );

      const user = await get(
        db,
        'SELECT id FROM users WHERE username = ?',
        [u.username]
      );

      userIds.push(user.id);
      console.log(`  User: ${u.username} (id=${user.id})`);
    }

    for (let i = 0; i < 200; i += 1) {
      const userId = userIds[randomBetween(0, userIds.length - 1)];
      const feature = randomFeature();
      const ts = randomDate(90);

      await run(
        db,
        `INSERT INTO feature_clicks (user_id, feature_name, timestamp)
         VALUES (?, ?, ?)`,
        [userId, feature, ts]
      );
    }

    console.log('  Inserted 200 feature click events');

    await run(db, 'COMMIT');

    const total = await get(db, 'SELECT COUNT(*) as n FROM feature_clicks');

    console.log(`\nSeed complete! Total feature clicks in DB: ${total.n}`);
    console.log('\nDemo login credentials:');
    USERS.forEach((u) => console.log(`  ${u.username} / ${u.password}`));

  } catch (err) {
    await run(db, 'ROLLBACK');
    console.error('Seed failed:', err);
    throw err;
  }
}

// Export function
module.exports = seed;

if (require.main === module) {
  seed()
    .then(() => {
      console.log("Seed finished");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}

seed();

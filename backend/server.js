require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { getDb } = require('./db');
const { authMiddleware, generateToken } = require('./auth');

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL;

app.use(cors(
  FRONTEND_URL
    ? { origin: FRONTEND_URL, credentials: true }
    : { origin: true, credentials: false }
));

app.use(express.json());

function runAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function isValidIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/register', async (req, res) => {
  const { username, password, age, gender } = req.body;
  const normalizedUsername = typeof username === 'string' ? username.trim() : '';

  if (!normalizedUsername || !password || !age || !gender) {
    return res.status(400).json({ error: 'All fields required' });
  }

  if (!['Male', 'Female', 'Other'].includes(gender)) {
    return res.status(400).json({ error: 'Invalid gender' });
  }

  const ageNum = parseInt(age, 10);
  if (Number.isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
    return res.status(400).json({ error: 'Invalid age' });
  }

  try {
    const db = getDb();
    const hashed = bcrypt.hashSync(password, 10);

    const result = await runAsync(
      db,
      `INSERT INTO users (username, password, age, gender)
       VALUES (?, ?, ?, ?)`,
      [normalizedUsername, hashed, ageNum, gender]
    );

    const user = {
      id: result.lastID,
      username: normalizedUsername,
      age: ageNum,
      gender,
    };

    const token = generateToken(user);
    return res.status(201).json({ token, user });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const normalizedUsername = typeof username === 'string' ? username.trim() : '';

  if (!normalizedUsername || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const db = getDb();

    const user = await getAsync(
      db,
      'SELECT * FROM users WHERE username = ?',
      [normalizedUsername]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        age: user.age,
        gender: user.gender,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/track', authMiddleware, async (req, res) => {
  const { feature_name } = req.body;

  if (!feature_name) {
    return res.status(400).json({ error: 'feature_name required' });
  }

  try {
    const db = getDb();

    const result = await runAsync(
      db,
      `INSERT INTO feature_clicks
       (user_id, feature_name, timestamp)
       VALUES (?, ?, datetime('now'))`,
      [req.user.id, feature_name]
    );

    return res.status(201).json({
      id: result.lastID,
      feature_name,
      user_id: req.user.id,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/analytics', authMiddleware, async (req, res) => {
  try {
    const db = getDb();

    const {
      start_date,
      end_date,
      age,
      gender,
      feature,
    } = req.query;

    if (start_date && !isValidIsoDate(start_date)) {
      return res.status(400).json({ error: 'Invalid start_date format (YYYY-MM-DD expected)' });
    }
    if (end_date && !isValidIsoDate(end_date)) {
      return res.status(400).json({ error: 'Invalid end_date format (YYYY-MM-DD expected)' });
    }
    if (start_date && end_date && start_date > end_date) {
      return res.status(400).json({ error: 'start_date cannot be after end_date' });
    }

    const where = [];
    const params = [];

    if (start_date) {
      where.push('fc.timestamp >= ?');
      params.push(start_date);
    }

    if (end_date) {
      where.push('fc.timestamp <= ?');
      params.push(`${end_date} 23:59:59`);
    }

    if (gender && gender !== 'all') {
      where.push('u.gender = ?');
      params.push(gender);
    }

    if (age === '<18') {
      where.push('u.age < 18');
    }

    if (age === '18-40') {
      where.push('u.age BETWEEN 18 AND 40');
    }

    if (age === '>40') {
      where.push('u.age > 40');
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const barData = await allAsync(
      db,
      `
      SELECT fc.feature_name,
      COUNT(*) as total_clicks
      FROM feature_clicks fc
      JOIN users u ON fc.user_id = u.id
      ${whereClause}
      GROUP BY fc.feature_name
      ORDER BY total_clicks DESC
      `,
      params
    );

    let lineWhere = whereClause;
    const lineParams = [...params];

    if (feature && feature !== 'all') {
      lineWhere = lineWhere
        ? `${lineWhere} AND fc.feature_name = ?`
        : 'WHERE fc.feature_name = ?';
      lineParams.push(feature);
    }

    const lineData = await allAsync(
      db,
      `
      SELECT DATE(fc.timestamp) as date,
      fc.feature_name,
      COUNT(*) as clicks
      FROM feature_clicks fc
      JOIN users u ON fc.user_id = u.id
      ${lineWhere}
      GROUP BY date, fc.feature_name
      ORDER BY date
      `,
      lineParams
    );

    const totalResult = await getAsync(
      db,
      `
      SELECT COUNT(*) as total
      FROM feature_clicks fc
      JOIN users u ON fc.user_id = u.id
      ${whereClause}
      `,
      params
    );

    return res.json({
      bar_chart: barData,
      line_chart: lineData,
      total_clicks: totalResult.total,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

app.listen(PORT, () => {
  console.log(`Analytics API running on http://localhost:${PORT}`);
  getDb();
});

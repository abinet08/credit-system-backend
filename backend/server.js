require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { initDB, db } = require('./database');
const { generateToken, verifyToken, requireAdmin } = require('./auth');
const { calculateScore, getRating } = require('./scoreEngine');

const app = express();
app.use(cors());
app.use(express.json());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use(limiter);

// Helper to update score and insert history
async function updateScoreAndHistory(userId) {
  const profile = await db.getAsync(`SELECT * FROM credit_profiles WHERE user_id = ?`, [userId]);
  if (!profile) return null;
  const score = calculateScore(profile);
  await db.runAsync(`INSERT INTO score_history (user_id, score) VALUES (?, ?)`, [userId, score]);
  return score;
}

// Start server only after DB is ready
async function startServer() {
  await initDB();
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

// Register
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const hashed = await bcrypt.hash(password, 10);
  try {
    const result = await db.runAsync(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hashed]);
    const userId = result.lastID;
    await db.runAsync(`INSERT INTO credit_profiles (user_id) VALUES (?)`, [userId]);
    await updateScoreAndHistory(userId);  // ✅ fixed: now awaited
    const token = generateToken({ id: userId, username, isAdmin: 0 });
    res.json({ token, user: { id: userId, username, isAdmin: false } });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await db.getAsync(`SELECT * FROM users WHERE username = ?`, [username]);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });
  const token = generateToken(user);
  res.json({ token, user: { id: user.id, username: user.username, isAdmin: user.isAdmin === 1 } });
});

// Get current user's credit profile and score
app.get('/api/profile', verifyToken, async (req, res) => {
  const profile = await db.getAsync(`SELECT * FROM credit_profiles WHERE user_id = ?`, [req.user.id]);
  if (!profile) return res.status(404).json({ error: 'No profile found' });
  const score = calculateScore(profile);
  const rating = getRating(score);
  res.json({ ...profile, score, rating });
});

// Update credit factors
app.put('/api/profile', verifyToken, async (req, res) => {
  const { payment_history, utilization, credit_age_years, credit_mix_score, new_credit_inquiries } = req.body;
  const fields = [];
  const values = [];
  if (payment_history !== undefined) { fields.push('payment_history = ?'); values.push(payment_history); }
  if (utilization !== undefined) { fields.push('utilization = ?'); values.push(utilization); }
  if (credit_age_years !== undefined) { fields.push('credit_age_years = ?'); values.push(credit_age_years); }
  if (credit_mix_score !== undefined) { fields.push('credit_mix_score = ?'); values.push(credit_mix_score); }
  if (new_credit_inquiries !== undefined) { fields.push('new_credit_inquiries = ?'); values.push(new_credit_inquiries); }
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(req.user.id);
  await db.runAsync(`UPDATE credit_profiles SET ${fields.join(', ')}, last_updated = CURRENT_TIMESTAMP WHERE user_id = ?`, values);
  const newScore = await updateScoreAndHistory(req.user.id);
  const updatedProfile = await db.getAsync(`SELECT * FROM credit_profiles WHERE user_id = ?`, [req.user.id]);
  res.json({ ...updatedProfile, score: newScore, rating: getRating(newScore) });
});

// Get score history
app.get('/api/history', verifyToken, async (req, res) => {
  const history = await db.allAsync(`SELECT score, recorded_at FROM score_history WHERE user_id = ? ORDER BY recorded_at ASC`, [req.user.id]);
  res.json(history);
});

// Admin: list all users with latest score
app.get('/api/admin/users', verifyToken, requireAdmin, async (req, res) => {
  const users = await db.allAsync(`
    SELECT u.id, u.username, u.isAdmin, 
      (SELECT score FROM score_history WHERE user_id = u.id ORDER BY recorded_at DESC LIMIT 1) as latest_score
    FROM users u
  `);
  res.json(users);
});

startServer();
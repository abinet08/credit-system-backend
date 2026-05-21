const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'credit.db');
const db = new sqlite3.Database(dbPath);

// Promisify database methods
db.runAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

db.getAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

db.allAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

async function initDB() {
  // Create tables
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      isAdmin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS credit_profiles (
      user_id INTEGER PRIMARY KEY,
      payment_history INTEGER DEFAULT 80,
      utilization INTEGER DEFAULT 30,
      credit_age_years INTEGER DEFAULT 2,
      credit_mix_score INTEGER DEFAULT 60,
      new_credit_inquiries INTEGER DEFAULT 2,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS score_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      score INTEGER,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Insert default admin (username: admin, password: admin123) if not exists
  const existingAdmin = await db.getAsync(`SELECT * FROM users WHERE username = ?`, ['admin']);
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await db.runAsync(
      `INSERT INTO users (username, password, isAdmin) VALUES (?, ?, ?)`,
      ['admin', hashedPassword, 1]
    );
    console.log('Default admin user created (admin / admin123)');
  }

  console.log('Database initialized successfully');
}

module.exports = { db, initDB };
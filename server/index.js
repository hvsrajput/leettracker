require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 5000;

// Database
const dbPath = path.join(__dirname, 'db', 'tracker.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth')(db));
app.use('/api/patterns', require('./routes/patterns')(db));
app.use('/api/problems', require('./routes/problems')(db));
app.use('/api/groups', require('./routes/groups')(db));
app.use('/api/dashboard', require('./routes/dashboard')(db));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 LeetCode Tracker API running on http://localhost:${PORT}`);
});

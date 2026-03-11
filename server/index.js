require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { scanItems } = require('./db/dynamodb');
const { backupToS3 } = require('./backup');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes — no longer pass db, each route uses dynamodb.js internally
app.use('/api/auth', require('./routes/auth')());
app.use('/api/patterns', require('./routes/patterns')());
app.use('/api/problems', require('./routes/problems')());
app.use('/api/groups', require('./routes/groups')());
app.use('/api/dashboard', require('./routes/dashboard')());
app.use('/api/leetcode', require('./routes/leetcode')());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Backup endpoint — saves to S3 and returns JSON
app.get('/api/backup', async (req, res) => {
  try {
    // Upload to S3
    const s3Result = await backupToS3();

    // Also return the data as downloadable JSON
    const allItems = await scanItems();
    res.setHeader('Content-Disposition', `attachment; filename=leettracker-backup-${new Date().toISOString().slice(0, 10)}.json`);
    res.json({
      exportedAt: new Date().toISOString(),
      itemCount: allItems.length,
      s3: s3Result,
      items: allItems,
    });
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ error: 'Backup failed' });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Only start listening when running locally (not in Lambda)
if (process.env.AWS_LAMBDA_FUNCTION_NAME === undefined) {
  app.listen(PORT, () => {
    console.log(`🚀 LeetCode Tracker API running on http://localhost:${PORT}`);
  });
}

module.exports = app;

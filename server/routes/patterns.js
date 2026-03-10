const express = require('express');
const { auth } = require('../middleware/auth');

const router = express.Router();

module.exports = function(db) {
  // Get all patterns
  router.get('/', auth, (req, res) => {
    const patterns = db.prepare('SELECT * FROM patterns ORDER BY is_default DESC, name ASC').all();
    res.json(patterns);
  });

  // Add custom pattern
  router.post('/', auth, (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Pattern name is required' });
    }

    const existing = db.prepare('SELECT id FROM patterns WHERE name = ?').get(name.trim());
    if (existing) {
      return res.status(400).json({ error: 'Pattern already exists' });
    }

    const result = db.prepare('INSERT INTO patterns (name, is_default, created_by) VALUES (?, 0, ?)').run(name.trim(), req.userId);
    res.json({ id: result.lastInsertRowid, name: name.trim(), is_default: 0 });
  });

  return router;
};

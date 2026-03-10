const express = require('express');
const path = require('path');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Load the problems dataset
const problemsDataset = require('../data/problems.json');
const datasetMap = new Map();
problemsDataset.forEach(p => datasetMap.set(p.number, p));

module.exports = function(db) {
  // Lookup problem metadata from dataset (preview before adding)
  router.get('/lookup/:number', auth, (req, res) => {
    const num = parseInt(req.params.number);
    const data = datasetMap.get(num);
    if (!data) {
      return res.status(404).json({ error: 'Problem not found in dataset. You can still add it manually.' });
    }
    res.json(data);
  });

  // Get problems with filters
  router.get('/', auth, (req, res) => {
    const { pattern, difficulty, solved } = req.query;
    
    let query = `
      SELECT p.*, pat.name as pattern_name,
        COALESCE(up.solved, 0) as solved
      FROM problems p
      LEFT JOIN patterns pat ON p.pattern_id = pat.id
      LEFT JOIN user_progress up ON up.problem_id = p.id AND up.user_id = ?
      WHERE 1=1
    `;
    const params = [req.userId];

    if (pattern && pattern !== 'all') {
      query += ' AND pat.name = ?';
      params.push(pattern);
    }
    if (difficulty) {
      query += ' AND p.difficulty = ?';
      params.push(difficulty);
    }
    if (solved === 'true') {
      query += ' AND COALESCE(up.solved, 0) = 1';
    } else if (solved === 'false') {
      query += ' AND COALESCE(up.solved, 0) = 0';
    }

    query += ' ORDER BY p.leetcode_number ASC';
    const problems = db.prepare(query).all(...params);
    res.json(problems);
  });

  // Add problem by LeetCode number
  router.post('/', auth, (req, res) => {
    const { leetcode_number, title: manualTitle, difficulty: manualDiff, url: manualUrl, pattern_name } = req.body;
    const num = parseInt(leetcode_number);
    if (!num) {
      return res.status(400).json({ error: 'LeetCode number is required' });
    }

    // Check if already exists
    const existing = db.prepare('SELECT * FROM problems WHERE leetcode_number = ?').get(num);
    if (existing) {
      return res.status(400).json({ error: 'Problem already added', problem: existing });
    }

    // Lookup from dataset
    const data = datasetMap.get(num);
    const title = data ? data.title : (manualTitle || `Problem ${num}`);
    const difficulty = data ? data.difficulty : (manualDiff || 'Medium');
    const url = data ? data.url : (manualUrl || `https://leetcode.com/problems/problem-${num}/`);
    
    // Determine pattern
    let patternId = null;
    if (pattern_name) {
      const pat = db.prepare('SELECT id FROM patterns WHERE name = ?').get(pattern_name);
      if (pat) patternId = pat.id;
    } else if (data && data.topics && data.topics.length > 0) {
      // Use first topic from dataset
      const pat = db.prepare('SELECT id FROM patterns WHERE name = ?').get(data.topics[0]);
      if (pat) patternId = pat.id;
    }

    const result = db.prepare(
      'INSERT INTO problems (leetcode_number, title, difficulty, url, pattern_id, added_by) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(num, title, difficulty, url, patternId, req.userId);

    const problem = db.prepare(`
      SELECT p.*, pat.name as pattern_name 
      FROM problems p 
      LEFT JOIN patterns pat ON p.pattern_id = pat.id 
      WHERE p.id = ?
    `).get(result.lastInsertRowid);

    res.json(problem);
  });

  // Toggle solved status
  router.post('/:id/toggle', auth, (req, res) => {
    const problemId = parseInt(req.params.id);
    const problem = db.prepare('SELECT id FROM problems WHERE id = ?').get(problemId);
    if (!problem) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    const existing = db.prepare('SELECT * FROM user_progress WHERE user_id = ? AND problem_id = ?').get(req.userId, problemId);
    
    if (existing) {
      const newSolved = existing.solved ? 0 : 1;
      db.prepare('UPDATE user_progress SET solved = ?, solved_at = ? WHERE user_id = ? AND problem_id = ?')
        .run(newSolved, newSolved ? new Date().toISOString() : null, req.userId, problemId);
      res.json({ solved: newSolved });
    } else {
      db.prepare('INSERT INTO user_progress (user_id, problem_id, solved, solved_at) VALUES (?, ?, 1, ?)')
        .run(req.userId, problemId, new Date().toISOString());
      res.json({ solved: 1 });
    }
  });

  return router;
};

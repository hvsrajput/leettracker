const express = require('express');
const { auth } = require('../middleware/auth');
const { putItem, getItem, queryItems, scanItems, updateItem, deleteItem } = require('../db/dynamodb');

const router = express.Router();

// Load the problems dataset
const problemsDataset = require('../data/problems.json');
const datasetMap = new Map();
problemsDataset.forEach(p => datasetMap.set(p.number, p));

module.exports = function () {
  // Search problems from dataset (autocomplete)
  router.get('/search', auth, (req, res) => {
    const query = (req.query.q || '').toLowerCase().trim();
    if (!query) {
      return res.json([]);
    }

    const isNumber = !isNaN(query) && query.length > 0;
    
    // Filter dataset based on query matching title or number
    let results = problemsDataset.filter(p => {
      if (isNumber) {
        return String(p.number).startsWith(query);
      }
      return p.title.toLowerCase().includes(query);
    });

    // Sort exact or prefix matches higher
    if (!isNumber) {
      results.sort((a, b) => {
        const aTitle = a.title.toLowerCase();
        const bTitle = b.title.toLowerCase();
        const aStarts = aTitle.startsWith(query) ? 1 : 0;
        const bStarts = bTitle.startsWith(query) ? 1 : 0;
        return bStarts - aStarts; 
      });
    }

    // Return top 10 results
    res.json(results.slice(0, 10));
  });

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
  router.get('/', auth, async (req, res) => {
    try {
      const { pattern, difficulty, solved } = req.query;

      // Get all problems
      let problems = await scanItems(
        'begins_with(PK, :prefix) AND SK = :sk',
        { ':prefix': 'PROBLEM#', ':sk': 'DETAIL' }
      );

      // Apply filters
      if (pattern && pattern !== 'all') {
        problems = problems.filter(p => p.patternName === pattern);
      }
      if (difficulty) {
        problems = problems.filter(p => p.difficulty === difficulty);
      }

      // Get user progress for all problems
      const progressItems = await queryItems(`PROGRESS#${req.userId}`, 'PROB#');
      const progressMap = {};
      progressItems.forEach(p => {
        const lcNum = p.SK.replace('PROB#', '');
        progressMap[lcNum] = p.solved;
      });

      // Attach solved status
      let result = problems.map(p => ({
        id: p.leetcodeNumber, // Use leetcode number as ID
        leetcode_number: p.leetcodeNumber,
        title: p.title,
        slug: p.slug,
        difficulty: p.difficulty,
        url: p.url,
        pattern_name: p.patternName || null,
        added_by: p.addedBy,
        created_at: p.createdAt,
        solved: progressMap[String(p.leetcodeNumber)] || 0,
      }));

      // Filter by solved status
      if (solved === 'true') {
        result = result.filter(p => p.solved === 1);
      } else if (solved === 'false') {
        result = result.filter(p => p.solved === 0 || !p.solved);
      }

      // Sort by leetcode number
      result.sort((a, b) => a.leetcode_number - b.leetcode_number);

      res.json(result);
    } catch (err) {
      console.error('Get problems error:', err);
      res.status(500).json({ error: 'Failed to get problems' });
    }
  });

  // Add problem by LeetCode number
  router.post('/', auth, async (req, res) => {
    try {
      const { leetcode_number, title: manualTitle, difficulty: manualDiff, url: manualUrl, pattern_name } = req.body;
      const num = parseInt(leetcode_number);
      if (!num) {
        return res.status(400).json({ error: 'LeetCode number is required' });
      }

      // Check if already exists
      const existing = await getItem(`PROBLEM#${num}`, 'DETAIL');
      if (existing) {
        return res.status(400).json({
          error: 'Problem already added',
          problem: {
            id: existing.leetcodeNumber,
            leetcode_number: existing.leetcodeNumber,
            title: existing.title,
            difficulty: existing.difficulty,
            url: existing.url,
            pattern_name: existing.patternName,
          },
        });
      }

      // Lookup from dataset
      const data = datasetMap.get(num);
      const title = data ? data.title : (manualTitle || `Problem ${num}`);
      const difficulty = data ? data.difficulty : (manualDiff || 'Medium');
      const slug = data ? data.slug : (manualTitle ? manualTitle.toLowerCase().replace(/\\s+/g, '-') : `problem-${num}`);
      const url = data ? data.url : (manualUrl || `https://leetcode.com/problems/${slug}/`);

      // Determine pattern name
      let patternName = null;
      if (pattern_name) {
        patternName = pattern_name;
      } else if (data && data.topics && data.topics.length > 0) {
        patternName = data.topics[0];
      }

      const createdAt = new Date().toISOString();

      if (patternName) {
        const existingPattern = await queryItems('PATTERN', `PAT#${patternName}`);
        if (existingPattern.length === 0) {
          await putItem({
            PK: 'PATTERN',
            SK: `PAT#${patternName}`,
            name: patternName,
            isDefault: 0,
            createdBy: req.userId,
          });
        }
      }

      await putItem({
        PK: `PROBLEM#${num}`,
        SK: 'DETAIL',
        leetcodeNumber: num,
        title,
        slug,
        difficulty,
        url,
        patternName,
        addedBy: req.userId,
        createdAt,
      });

      res.json({
        id: num,
        leetcode_number: num,
        title,
        slug,
        difficulty,
        url,
        pattern_name: patternName,
        added_by: req.userId,
        created_at: createdAt,
      });
    } catch (err) {
      console.error('Add problem error:', err);
      res.status(500).json({ error: 'Failed to add problem' });
    }
  });

  // Toggle solved status
  router.post('/:id/toggle', auth, async (req, res) => {
    try {
      const problemId = parseInt(req.params.id);

      // Check problem exists
      const problem = await getItem(`PROBLEM#${problemId}`, 'DETAIL');
      if (!problem) {
        return res.status(404).json({ error: 'Problem not found' });
      }

      // Check current progress
      const progress = await getItem(`PROGRESS#${req.userId}`, `PROB#${problemId}`);

      if (progress) {
        const newSolved = progress.solved ? 0 : 1;
        await updateItem(
          `PROGRESS#${req.userId}`,
          `PROB#${problemId}`,
          'SET solved = :s, solvedAt = :sa',
          {
            ':s': newSolved,
            ':sa': newSolved ? new Date().toISOString() : null,
          }
        );
        res.json({ solved: newSolved });
      } else {
        await putItem({
          PK: `PROGRESS#${req.userId}`,
          SK: `PROB#${problemId}`,
          solved: 1,
          solvedAt: new Date().toISOString(),
        });
        res.json({ solved: 1 });
      }
    } catch (err) {
      console.error('Toggle error:', err);
      res.status(500).json({ error: 'Failed to toggle problem status' });
    }
  });

  // Delete problem
  router.delete('/:id', auth, async (req, res) => {
    try {
      const problemId = parseInt(req.params.id);
      
      const existing = await getItem(`PROBLEM#${problemId}`, 'DETAIL');
      if (!existing) {
        return res.status(404).json({ error: 'Problem not found' });
      }

      await deleteItem(`PROBLEM#${problemId}`, 'DETAIL');
      
      res.json({ success: true });
    } catch (err) {
      console.error('Delete problem error:', err);
      res.status(500).json({ error: 'Failed to delete problem' });
    }
  });

  return router;
};

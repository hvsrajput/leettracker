const express = require('express');
const { auth } = require('../middleware/auth');
const { putItem, getItem, queryItems, scanItems, deleteItem, batchGetItems } = require('../db/dynamodb');
const { getProblemsDataset, getProblemByNumber } = require('../utils/problemsDataset');

const router = express.Router();

async function setProblemStatus(userId, problemId, newStatus) {
  const timestamp = new Date().toISOString();
  const existingProgress = await getItem(`PROGRESS#${userId}`, `PROB#${problemId}`);

  await putItem({
    PK: `PROGRESS#${userId}`,
    SK: `PROB#${problemId}`,
    solved: newStatus === 'solved' ? 1 : 0,
    status: newStatus,
    solvedAt: newStatus === 'solved' ? timestamp : null,
    attemptedAt: newStatus === 'attempted' ? (existingProgress?.attemptedAt || timestamp) : (existingProgress?.attemptedAt || null),
  });

  return {
    solved: newStatus === 'solved' ? 1 : 0,
    status: newStatus,
  };
}

module.exports = function () {
  // Search problems from dataset (autocomplete)
  router.get('/search', auth, (req, res) => {
    const query = (req.query.q || '').toLowerCase().trim();
    const problemsDataset = getProblemsDataset();
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
    const data = getProblemByNumber(num);
    if (!data) {
      return res.status(404).json({ error: 'Problem not found in dataset. You can still add it manually.' });
    }
    res.json(data);
  });

  // Get problems with filters
  router.get('/', auth, async (req, res) => {
    try {
      const { pattern, difficulty, solved, company } = req.query;

      // Get user progress for all problems
      const progressItems = await queryItems(`PROGRESS#${req.userId}`, 'PROB#');
      let trackedProblems = progressItems.map((progress) => {
        const lcNum = progress.SK.replace('PROB#', '');
        const status = progress.status || (progress.solved === 1 ? 'solved' : 'unsolved');
        return {
          id: lcNum,
          solved: progress.solved || 0,
          status,
        };
      });

      if (solved === 'true') {
        trackedProblems = trackedProblems.filter((problem) => problem.status === 'solved');
      } else if (solved === 'false') {
        trackedProblems = trackedProblems.filter((problem) => problem.status === 'unsolved');
      } else if (solved === 'attempted') {
        trackedProblems = trackedProblems.filter((problem) => problem.status === 'attempted');
      }

      if (trackedProblems.length === 0) {
        return res.json([]);
      }

      const problemItems = await batchGetItems(
        trackedProblems.map((problem) => ({
          PK: `PROBLEM#${problem.id}`,
          SK: 'DETAIL',
        }))
      );

      const problemMap = new Map(
        problemItems.map((problem) => [String(problem.leetcodeNumber), problem])
      );

      let result = trackedProblems
        .map((progress) => {
          const problem = problemMap.get(progress.id);
          if (!problem) {
            return null;
          }

          const datasetEntry = getProblemByNumber(problem.leetcodeNumber);
          return {
            id: problem.leetcodeNumber,
            leetcode_number: problem.leetcodeNumber,
            title: problem.title,
            slug: problem.slug,
            difficulty: problem.difficulty,
            url: problem.url,
            pattern_name: problem.patternName || null,
            added_by: problem.addedBy,
            created_at: problem.createdAt,
            solved: progress.solved,
            status: progress.status,
            companies: datasetEntry ? (datasetEntry.companies || []) : [],
            topics: datasetEntry ? (datasetEntry.topics || []) : [],
          };
        })
        .filter(Boolean);

      if (pattern && pattern !== 'all') {
        result = result.filter((problem) => (
          problem.pattern_name === pattern || problem.topics.includes(pattern)
        ));
      }

      if (difficulty) {
        result = result.filter((problem) => problem.difficulty === difficulty);
      }

      if (company && company !== 'all') {
        result = result.filter((problem) => problem.companies.includes(company));
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

      const datasetEntry = getProblemByNumber(num);

      // Check if already tracking
      const progress = await getItem(`PROGRESS#${req.userId}`, `PROB#${num}`);
      if (progress) {
        return res.status(400).json({
          error: 'Problem already in your list',
          problem: {
            id: num,
            leetcode_number: num,
            title: datasetEntry?.title || manualTitle || `Problem ${num}`,
            difficulty: datasetEntry?.difficulty || manualDiff || 'Medium',
            url: datasetEntry?.url || manualUrl || null,
            pattern_name: datasetEntry?.topics?.[0] || pattern_name || null,
            topics: datasetEntry?.topics || [],
            companies: datasetEntry?.companies || [],
            status: progress.status || (progress.solved === 1 ? 'solved' : 'unsolved'),
            solved: progress.solved || 0,
          },
        });
      }

      // Lookup from dataset
      let title, difficulty, slug, url, patternName = null;
      const existing = await getItem(`PROBLEM#${num}`, 'DETAIL');
      
      if (existing) {
        // Use existing metadata
        title = existing.title;
        difficulty = existing.difficulty;
        slug = existing.slug;
        url = existing.url;
        patternName = existing.patternName;
      } else {
        // Fallback to dataset or manual entry
        const data = datasetEntry;
        title = data ? data.title : (manualTitle || `Problem ${num}`);
        difficulty = data ? data.difficulty : (manualDiff || 'Medium');
        slug = data ? data.slug : (manualTitle ? manualTitle.toLowerCase().replace(/\\s+/g, '-') : `problem-${num}`);
        url = data ? data.url : (manualUrl || `https://leetcode.com/problems/${slug}/`);

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
      }

      // Add to user's progress
      await putItem({
        PK: `PROGRESS#${req.userId}`,
        SK: `PROB#${num}`,
        solved: 0,
        status: 'unsolved',
        solvedAt: null,
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
        status: 'unsolved',
        solved: 0,
        topics: datasetEntry?.topics || [],
        companies: datasetEntry?.companies || [],
      });
    } catch (err) {
      console.error('Add problem error:', err);
      res.status(500).json({ error: 'Failed to add problem' });
    }
  });

  // Toggle solved status (3 states: unsolved -> attempted -> solved -> unsolved)
  router.post('/:id/toggle', auth, async (req, res) => {
    try {
      const problemId = parseInt(req.params.id);

      // Check problem exists
      const problem = await getItem(`PROBLEM#${problemId}`, 'DETAIL');
      if (!problem) {
        return res.status(404).json({ error: 'Problem not found' });
      }

      const progress = await getItem(`PROGRESS#${req.userId}`, `PROB#${problemId}`);
      const currentStatus = progress?.status || (progress?.solved ? 'solved' : 'unsolved');

      let newStatus = 'attempted';
      if (currentStatus === 'attempted') {
        newStatus = 'solved';
      } else if (currentStatus === 'solved') {
        newStatus = 'unsolved';
      }

      const result = await setProblemStatus(req.userId, problemId, newStatus);
      res.json(result);
    } catch (err) {
      console.error('Toggle error:', err);
      res.status(500).json({ error: 'Failed to toggle problem status' });
    }
  });

  router.post('/:id/status', auth, async (req, res) => {
    try {
      const problemId = parseInt(req.params.id);
      const { status } = req.body;

      if (!['unsolved', 'attempted', 'solved'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const problem = await getItem(`PROBLEM#${problemId}`, 'DETAIL');
      if (!problem) {
        return res.status(404).json({ error: 'Problem not found' });
      }

      const result = await setProblemStatus(req.userId, problemId, status);
      res.json(result);
    } catch (err) {
      console.error('Set status error:', err);
      res.status(500).json({ error: 'Failed to update problem status' });
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

      // Only remove the user's progress for this problem, effectively "untracking" it.
      await deleteItem(`PROGRESS#${req.userId}`, `PROB#${problemId}`);
      
      // Clean up all GROUP# PROBLEM# entries if current user added it? 
      // Safest is to just untrack for the user. 
      // Wait, we can optionally clean up the group entries if they add it from groups, but we will leave them for now.


      // Clean up all GROUP# PROBLEM# entries referencing this problem
      const groupProblemItems = await scanItems(
        'begins_with(PK, :prefix) AND SK = :sk',
        { ':prefix': 'GROUP#', ':sk': `PROBLEM#${problemId}` }
      );
      for (const gp of groupProblemItems) {
        await deleteItem(gp.PK, gp.SK);
      }

      // Clean up orphaned pattern if no other problems use it
      if (existing.patternName) {
        const remaining = await scanItems(
          'begins_with(PK, :prefix) AND patternName = :pattern',
          { ':prefix': 'PROBLEM#', ':pattern': existing.patternName }
        );
        if (remaining.length === 0) {
          await deleteItem('PATTERN', `PAT#${existing.patternName}`);
        }
      }

      res.json({ success: true });
    } catch (err) {
      console.error('Delete problem error:', err);
      res.status(500).json({ error: 'Failed to delete problem' });
    }
  });

  return router;
};

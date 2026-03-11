const express = require('express');
const { auth } = require('../middleware/auth');
const { queryItems, scanItems } = require('../db/dynamodb');

const router = express.Router();

module.exports = function () {
  router.get('/', auth, async (req, res) => {
    try {
      // Get all problems
      const problems = await scanItems(
        'begins_with(PK, :prefix) AND SK = :sk',
        { ':prefix': 'PROBLEM#', ':sk': 'DETAIL' }
      );

      // Get user progress
      const progressItems = await queryItems(`PROGRESS#${req.userId}`, 'PROB#');
      const progressMap = {};
      progressItems.forEach(p => {
        const lcNum = p.SK.replace('PROB#', '');
        progressMap[lcNum] = { solved: p.solved, solvedAt: p.solvedAt };
      });

      const totalProblems = problems.length;
      let totalSolved = 0;

      // Pattern-wise and difficulty-wise breakdown
      const patternMap = {};
      const difficultyMap = {};

      problems.forEach(p => {
        const isSolved = progressMap[String(p.leetcodeNumber)]?.solved === 1;
        if (isSolved) totalSolved++;

        // Pattern stats
        if (p.patternName) {
          if (!patternMap[p.patternName]) {
            patternMap[p.patternName] = { name: p.patternName, total: 0, solved: 0 };
          }
          patternMap[p.patternName].total++;
          if (isSolved) patternMap[p.patternName].solved++;
        }

        // Difficulty stats
        if (p.difficulty) {
          if (!difficultyMap[p.difficulty]) {
            difficultyMap[p.difficulty] = { difficulty: p.difficulty, total: 0, solved: 0 };
          }
          difficultyMap[p.difficulty].total++;
          if (isSolved) difficultyMap[p.difficulty].solved++;
        }
      });

      const patternStats = Object.values(patternMap).sort((a, b) => a.name.localeCompare(b.name));
      const difficultyStats = Object.values(difficultyMap);

      // Group progress
      const userGroups = await queryItems(`USERGROUP#${req.userId}`, 'GROUP#');
      const groupStats = [];

      for (const ug of userGroups) {
        const groupId = ug.SK.replace('GROUP#', '');
        const detail = await queryItems(`GROUP#${groupId}`, 'DETAIL');
        if (!detail.length) continue;

        const groupProblems = await queryItems(`GROUP#${groupId}`, 'PROBLEM#');
        const memberItems = await queryItems(`GROUP#${groupId}`, 'MEMBER#');

        // Count solved by user
        let solvedCount = 0;
        for (const gp of groupProblems) {
          const lcNum = gp.SK.replace('PROBLEM#', '');
          if (progressMap[lcNum]?.solved === 1) solvedCount++;
        }

        groupStats.push({
          id: groupId,
          name: detail[0].name,
          total_problems: groupProblems.length,
          solved_problems: solvedCount,
          member_count: memberItems.length,
        });
      }

      // Recent activity — filter progress for solved items and sort
      const recentSolved = [];
      for (const [lcNum, prog] of Object.entries(progressMap)) {
        if (prog.solved === 1) {
          const problem = problems.find(p => String(p.leetcodeNumber) === lcNum);
          if (problem) {
            recentSolved.push({
              leetcode_number: problem.leetcodeNumber,
              title: problem.title,
              difficulty: problem.difficulty,
              solved_at: prog.solvedAt,
            });
          }
        }
      }
      recentSolved.sort((a, b) => new Date(b.solved_at) - new Date(a.solved_at));

      res.json({
        totalSolved,
        totalProblems,
        patternStats,
        difficultyStats,
        groupStats,
        recentSolved: recentSolved.slice(0, 10),
      });
    } catch (err) {
      console.error('Dashboard error:', err);
      res.status(500).json({ error: 'Failed to load dashboard' });
    }
  });

  // Heatmap Data Endpoint for GitHub-style graph
  router.get('/heatmap', auth, async (req, res) => {
    try {
      const { groupId } = req.query;
      let userIdsToFetch = [req.userId];

      // If a group is specified, fetch all members of that group
      if (groupId && groupId !== 'me') {
        const members = await queryItems(`GROUP#${groupId}`, 'MEMBER#');
        if (members.length > 0) {
           // We need their actual user IDs (emails), but MEMBER items only store username and joinedAt.
           // However, let's grab the member list and resolve their IDs. 
           // For simplicity in single-table, if the current schema doesn't map username->email easily without an index, 
           // we can scan the Users table or assume `req.userId` is the PK format (email).
           // Wait, MEMBER items have `PK = GROUP#<id>`, `SK = MEMBER#<email>`. So the email is in the SK!
           userIdsToFetch = members.map(m => m.SK.replace('MEMBER#', ''));
        } else {
           userIdsToFetch = []; // Empty group
        }
      }

      // Aggregate all solves per date (YYYY-MM-DD)
      const heatmapData = {};

      for (const uid of userIdsToFetch) {
        const progressItems = await queryItems(`PROGRESS#${uid}`, 'PROB#');
        for (const p of progressItems) {
          if (p.solved === 1 && p.solvedAt) {
            // Extract just the date part (YYYY-MM-DD)
            const dateStr = p.solvedAt.split('T')[0];
            heatmapData[dateStr] = (heatmapData[dateStr] || 0) + 1;
          }
        }
      }

      res.json(heatmapData);
    } catch (err) {
      console.error('Heatmap error:', err);
      res.status(500).json({ error: 'Failed to load heatmap data' });
    }
  });

  return router;
};

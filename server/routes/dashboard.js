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
        const status = p.status || (p.solved === 1 ? 'solved' : 'unsolved');
        progressMap[lcNum] = { solved: p.solved, solvedAt: p.solvedAt, status };
      });

      // Filter to only problems the user is tracking
      const trackedProblems = problems.filter(p => progressMap.hasOwnProperty(String(p.leetcodeNumber)));

      const totalProblems = trackedProblems.length;
      let totalSolved = 0;
      let totalAttempted = 0;

      // Pattern-wise and difficulty-wise breakdown
      const patternMap = {};
      const difficultyMap = {};

      trackedProblems.forEach(p => {
        const progress = progressMap[String(p.leetcodeNumber)];
        const status = progress?.status || 'unsolved';
        const isSolved = status === 'solved';
        const isAttempted = status === 'attempted';
        if (isSolved) totalSolved++;
        if (isAttempted) totalAttempted++;

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
        totalAttempted,
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

  // Pattern Heatmap (Strongest, Weakest, Neglected)
  router.get('/pattern-heatmap/:userId', auth, async (req, res) => {
    try {
      const uId = req.params.userId === 'me' ? req.userId : req.params.userId;
      
      const problems = await scanItems(
        'begins_with(PK, :prefix) AND SK = :sk',
        { ':prefix': 'PROBLEM#', ':sk': 'DETAIL' }
      );

      const progressItems = await queryItems(`PROGRESS#${uId}`, 'PROB#');
      const progressMap = {};
      progressItems.forEach(p => {
        if (p.solved === 1) progressMap[p.SK.replace('PROB#', '')] = true;
      });

      const patternMap = {};
      const trackedProblems = problems.filter(p => progressMap.hasOwnProperty(String(p.leetcodeNumber)));

      trackedProblems.forEach(p => {
        if (p.patternName) {
          if (!patternMap[p.patternName]) {
            patternMap[p.patternName] = { pattern: p.patternName, total: 0, solved: 0 };
          }
          patternMap[p.patternName].total++;
          if (progressMap[String(p.leetcodeNumber)]) {
            patternMap[p.patternName].solved++;
          }
        }
      });

      const allPatterns = Object.values(patternMap).map(p => ({
        pattern: p.pattern,
        percent: p.total > 0 ? Math.round((p.solved / p.total) * 100) : 0,
        solved: p.solved,
        total: p.total
      }));

      allPatterns.sort((a, b) => b.percent - a.percent);

      let strongest = null;
      let weakest = null;
      let neglected = null;

      if (allPatterns.length > 0) {
        strongest = allPatterns[0];
        // Weakest is the one with lowest % but > 0
        const attempted = allPatterns.filter(p => p.percent > 0);
        if (attempted.length > 0) {
          weakest = attempted[attempted.length - 1];
        } else {
          weakest = allPatterns[allPatterns.length - 1];
        }

        // Neglected is the one with 0% and reasonably high total (or just lowest strictly)
        const unattempted = allPatterns.filter(p => p.percent === 0).sort((a, b) => b.total - a.total);
        if (unattempted.length > 0) {
          neglected = unattempted[0];
        }
      }

      res.json({ strongest, weakest, neglected, allPatterns });
    } catch (err) {
      console.error('Pattern Heatmap error:', err);
      res.status(500).json({ error: 'Failed to load pattern heatmap' });
    }
  });

  // Company Progress
  router.get('/company-progress/:userId', auth, async (req, res) => {
    try {
      const uId = req.params.userId === 'me' ? req.userId : req.params.userId;
      
      const problems = await scanItems(
        'begins_with(PK, :prefix) AND SK = :sk',
        { ':prefix': 'PROBLEM#', ':sk': 'DETAIL' }
      );

      // We need to fetch the company data from the raw dataset, since DynamoDB might not have it yet
      // if not backfilled, but we can backfill or join on the fly.
      const problemsDataset = require('../data/problems.json');
      const companyDataMap = {};
      problemsDataset.forEach(p => {
        companyDataMap[p.number] = p.companies || [];
      });

      const progressItems = await queryItems(`PROGRESS#${uId}`, 'PROB#');
      const progressMap = {};
      progressItems.forEach(p => {
        if (p.solved === 1) progressMap[p.SK.replace('PROB#', '')] = true;
      });

      const companyMap = {};
      problemsDataset.forEach(p => {
        (p.companies || []).forEach(company => {
          if (!companyMap[company]) {
            companyMap[company] = { company, solved: 0, total: 0 };
          }
          companyMap[company].total++;
          if (progressMap[String(p.number)]) {
            companyMap[company].solved++;
          }
        });
      });

      const result = Object.values(companyMap)
        .map(c => ({
          ...c,
          percent: c.total > 0 ? Math.round((c.solved / c.total) * 100) : 0
        }))
        .sort((a, b) => b.percent - a.percent || b.total - a.total); // Sort by % desc, then total desc

      res.json(result);
    } catch (err) {
      console.error('Company Progress error:', err);
      res.status(500).json({ error: 'Failed to load company progress' });
    }
  });

  return router;
};

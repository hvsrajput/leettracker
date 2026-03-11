const express = require('express');
const axios = require('axios');
const { auth } = require('../middleware/auth');
const { putItem, getItem, queryItems } = require('../db/dynamodb');

const router = express.Router();

// Load the problems dataset mapping for quick lookup by slug or id
const problemsDataset = require('../data/problems.json');
const datasetMapById = new Map();
const datasetMapBySlug = new Map();
problemsDataset.forEach(p => {
  datasetMapById.set(p.number, p);
  datasetMapBySlug.set(p.slug, p);
});

module.exports = function () {
  router.post('/import', auth, async (req, res) => {
    const { username, sessionCookie } = req.body;
    if (!username && !sessionCookie) {
      return res.status(400).json({ error: 'LeetCode username or Session Cookie is required' });
    }

    try {
      let recentSubs = [];
      
      if (sessionCookie) {
        // Authenticated REST API (Bypasses 20-item public limit)
        let offset = 0;
        let limit = 100;
        let hasNext = true;
        
        while (hasNext) {
          try {
            const subResp = await axios.get(`https://leetcode.com/api/submissions/?offset=${offset}&limit=${limit}`, {
              headers: {
                'Cookie': `LEETCODE_SESSION=${sessionCookie}`,
                'Referer': 'https://leetcode.com'
              }
            });
            const dump = subResp.data.submissions_dump || [];
            
            for (const sub of dump) {
              if (sub.status_display === 'Accepted') {
                recentSubs.push({
                  titleSlug: sub.title_slug,
                  timestamp: sub.timestamp
                });
              }
            }
            
            hasNext = subResp.data.has_next;
            offset += limit;
          } catch (err) {
            console.error('REST API Submissions error:', err.message);
            // Break loop on failure, but process what we got
            break; 
          }
        }
      } else {
        // Public GraphQL API (Hardcapped to 20 AC submissions)
        const leetcodeQuery = `
          query getUserProfile($username: String!) {
            recentAcSubmissionList(username: $username, limit: 50) {
              titleSlug
              timestamp
            }
          }
        `;
        const lcResp = await axios.post('https://leetcode.com/graphql', {
          query: leetcodeQuery,
          variables: { username }
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Referer': 'https://leetcode.com'
          }
        });
        
        recentSubs = lcResp.data?.data?.recentAcSubmissionList || [];
      }

      let importedCount = 0;
      for (const sub of recentSubs) {
        const problemData = datasetMapBySlug.get(sub.titleSlug);
        if (problemData) {
          const num = problemData.number;
          const solvedAt = new Date(parseInt(sub.timestamp) * 1000).toISOString();

          // Ensure problem exists
          const existingProb = await getItem(`PROBLEM#${num}`, 'DETAIL');
          if (!existingProb) {
            const patternName = problemData.topics?.[0] || 'Uncategorized';
            
            // Dynamic pattern creation
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
              title: problemData.title,
              slug: problemData.slug,
              difficulty: problemData.difficulty,
              url: problemData.url,
              patternName: patternName,
              addedBy: req.userId,
              createdAt: new Date().toISOString(),
            });
          }

          // Ensure progress exists
          const existingProgress = await getItem(`PROGRESS#${req.userId}`, `PROB#${num}`);
          if (!existingProgress || existingProgress.solved === 0) {
            await putItem({
              PK: `PROGRESS#${req.userId}`,
              SK: `PROB#${num}`,
              solved: 1,
              solvedAt: solvedAt,
            });
            importedCount++;
          }
        }
      }

      // If we also want to utilize calendarMap for Heatmap, we could store it in a special item UserStats.
      // But currently Heatmap.jsx relies on the `/dashboard/heatmap` which derives from PROGRESS# items directly + grouped items!
      // To make the Heatmap truly reflect all history, we can insert dummy PROGRESS# items for the missing ones, or we just rely on what we have.
      // Let's stick to importing the recent 100 AC submissions for now!

      res.json({ success: true, imported: importedCount });
    } catch (error) {
      console.error('LeetCode Import Error:', error);
      res.status(500).json({ error: 'Failed to import from LeetCode' });
    }
  });

  return router;
};

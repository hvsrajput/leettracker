const express = require('express');
const axios = require('axios');
const { auth } = require('../middleware/auth');
const { putItem, getItem } = require('../db/dynamodb');

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
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'LeetCode username is required' });
    }

    try {
      // Fetch user profile calendar and recent submissions
      const leetcodeQuery = `
        query getUserProfile($username: String!) {
          matchedUser(username: $username) {
            submissionCalendar
          }
          recentAcSubmissionList(username: $username, limit: 50) {
            id
            title
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

      const matchedUser = lcResp.data?.data?.matchedUser;
      if (!matchedUser) {
        return res.status(404).json({ error: 'LeetCode user not found' });
      }

      // 1. Process submission calendar
      // The calendar is a JSON string of UnixTimestamp (seconds) -> count mapped to dates
      let calendarMap = {};
      try {
        const calData = JSON.parse(matchedUser.submissionCalendar || '{}');
        Object.keys(calData).forEach(timestamp => {
          const date = new Date(parseInt(timestamp) * 1000).toISOString().split('T')[0];
          calendarMap[date] = (calendarMap[date] || 0) + calData[timestamp];
        });
      } catch (err) {
        console.error('Error parsing submission calendar:', err);
      }

      // Note: LeetCode doesn't return the exact problem ID in the submissionCalendar,
      // only the total count per day.
      // To import accurately, we will rely on recentAcSubmissionList instead for exact problems.
      // Since recentAcSubmissionList is limited to 20/50, we can also import all AC problems from userProfileUserQuestionProgressV2.
      // Wait, let's just make a second query to get all accepted problems!

      const progressQuery = `
        query userProfileUserQuestionProgressV2($userSlug: String!) {
          userProfileUserQuestionProgressV2(userSlug: $userSlug) {
            numAcceptedQuestions {
              count
              difficulty
            }
          }
          recentAcSubmissionList(username: $userSlug, limit: 100) {
            titleSlug
            timestamp
          }
        }
      `;

      // Actually LeetCode's API doesn't allow easily fetching ALL accepted submission dates for a user in one go.
      // We will just fetch the 100 most recent AC submissions, and apply the dates.
      // We will also use the submissionCalendar data to bulk update the User's heat map or we can just rely on PROGRESS# entries.
      // Wait, the Heatmap reads PROGRESS# resolved items dynamically. But we don't have dates for all of them.
      // For now, let's just insert PROGRESS# items for the recentAcSubmissionList.
      const recentSubs = lcResp.data?.data?.recentAcSubmissionList || [];
      
      let importedCount = 0;
      for (const sub of recentSubs) {
        const problemData = datasetMapBySlug.get(sub.titleSlug);
        if (problemData) {
          const num = problemData.number;
          const solvedAt = new Date(parseInt(sub.timestamp) * 1000).toISOString();

          // Ensure problem exists
          const existingProb = await getItem(`PROBLEM#${num}`, 'DETAIL');
          if (!existingProb) {
            await putItem({
              PK: `PROBLEM#${num}`,
              SK: 'DETAIL',
              leetcodeNumber: num,
              title: problemData.title,
              slug: problemData.slug,
              difficulty: problemData.difficulty,
              url: problemData.url,
              patternName: problemData.topics?.[0] || 'Uncategorized',
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

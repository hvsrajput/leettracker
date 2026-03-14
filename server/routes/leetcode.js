const express = require('express');
const axios = require('axios');
const { auth } = require('../middleware/auth');
const { putItem, getItem, queryItems } = require('../db/dynamodb');
const { getProblemBySlug } = require('../utils/problemsDataset');

const router = express.Router();

// Helper: fetch problem metadata from LeetCode GraphQL by titleSlug
async function fetchProblemFromLeetCode(titleSlug) {
  try {
    const query = `
      query questionData($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          questionFrontendId
          title
          titleSlug
          difficulty
          topicTags {
            name
          }
        }
      }
    `;
    const resp = await axios.post('https://leetcode.com/graphql', {
      query,
      variables: { titleSlug }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://leetcode.com'
      },
      timeout: 5000
    });
    
    const q = resp.data?.data?.question;
    if (!q || !q.questionFrontendId) return null;
    
    return {
      number: parseInt(q.questionFrontendId),
      title: q.title,
      slug: q.titleSlug,
      difficulty: q.difficulty,
      url: `https://leetcode.com/problems/${q.titleSlug}/`,
      topics: (q.topicTags || []).map(t => t.name)
    };
  } catch (err) {
    console.error(`Failed to fetch LeetCode problem "${titleSlug}":`, err.message);
    return null;
  }
}

// Helper: ensure problem exists in DB, create if not
async function ensureProblemExists(problemData, userId) {
  const num = problemData.number;
  const existingProb = await getItem(`PROBLEM#${num}`, 'DETAIL');
  if (!existingProb) {
    const patternName = problemData.topics?.[0] || 'Uncategorized';
    
    if (patternName) {
      const existingPattern = await queryItems('PATTERN', `PAT#${patternName}`);
      if (existingPattern.length === 0) {
        await putItem({
          PK: 'PATTERN',
          SK: `PAT#${patternName}`,
          name: patternName,
          isDefault: 0,
          createdBy: userId,
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
      url: problemData.url || `https://leetcode.com/problems/${problemData.slug}/`,
      patternName: patternName,
      addedBy: userId,
      createdAt: new Date().toISOString(),
    });
  }
}

// Helper: update progress with priority logic (solved > attempted > unsolved, never downgrade)
async function updateProgress(userId, num, newStatus, timestamp) {
  const existingProgress = await getItem(`PROGRESS#${userId}`, `PROB#${num}`);
  const currentStatus = existingProgress?.status || (existingProgress?.solved === 1 ? 'solved' : 'unsolved');
  
  // Priority: solved > attempted > unsolved. Never downgrade.
  const priority = { unsolved: 0, attempted: 1, solved: 2 };
  if (priority[newStatus] <= priority[currentStatus]) {
    return 'skipped'; // no change needed
  }
  
  const solvedAt = newStatus === 'solved' ? timestamp : (existingProgress?.solvedAt || null);
  
  await putItem({
    PK: `PROGRESS#${userId}`,
    SK: `PROB#${num}`,
    solved: newStatus === 'solved' ? 1 : 0,
    status: newStatus,
    solvedAt: solvedAt,
    attemptedAt: newStatus === 'attempted' ? timestamp : (existingProgress?.attemptedAt || null),
  });
  
  return newStatus === 'solved' ? 'solved' : 'attempted';
}

async function fetchAcceptedProblemData(username) {
  const profileQuery = `
    query userProfileUserQuestionProgressV2($userSlug: String!) {
      userProfileUserQuestionProgressV2(userSlug: $userSlug) {
        acceptedQuestionList { titleSlug }
      }
    }
  `;

  const response = await axios.post('https://leetcode.com/graphql', {
    query: profileQuery,
    variables: { userSlug: username }
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Referer': 'https://leetcode.com',
      'Origin': 'https://leetcode.com',
      'User-Agent': 'Mozilla/5.0',
    },
    timeout: 10000
  });

  if (response.data?.errors?.length) {
    throw new Error(response.data.errors[0].message || 'LeetCode profile lookup failed');
  }

  const progressData = response.data?.data?.userProfileUserQuestionProgressV2;
  if (!progressData) {
    const error = new Error('Could not find a public LeetCode profile for that username');
    error.statusCode = 404;
    throw error;
  }

  return progressData.acceptedQuestionList || [];
}

async function fetchRecentAcceptedSubmissionDates(username) {
  const subQuery = `
    query recentSubmissionList($username: String!, $limit: Int!) {
      recentSubmissionList(username: $username, limit: $limit) {
        titleSlug
        statusDisplay
        timestamp
      }
    }
  `;

  const response = await axios.post('https://leetcode.com/graphql', {
    query: subQuery,
    variables: { username, limit: 20 }
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Referer': 'https://leetcode.com',
      'Origin': 'https://leetcode.com',
      'User-Agent': 'Mozilla/5.0',
    },
    timeout: 5000
  });

  if (response.data?.errors?.length) {
    throw new Error(response.data.errors[0].message || 'Failed to fetch recent submissions');
  }

  return response.data?.data?.recentSubmissionList || [];
}

module.exports = function () {
  router.post('/import', auth, async (req, res) => {
    const { solvedMap } = req.body;

    if (!solvedMap || typeof solvedMap !== 'object' || Object.keys(solvedMap).length === 0) {
      return res.status(400).json({ error: 'solvedMap is required. Please follow the import instructions.' });
    }

    try {
      let solvedCount = 0;
      let alreadyExistsCount = 0;
      let failedCount = 0;

      for (const [slug, unixTimestamp] of Object.entries(solvedMap)) {
        try {
          // Strict mapping against problems.json dataset
          let problemData = getProblemBySlug(slug);
          
          if (!problemData) {
            failedCount++; // Problem not in dataset
            continue;
          }

          const num = problemData.number;
          const ts = new Date(parseInt(unixTimestamp) * 1000).toISOString();

          await ensureProblemExists(problemData, req.userId);
          
          const result = await updateProgress(req.userId, num, 'solved', ts);
          if (result === 'solved') solvedCount++;
          else alreadyExistsCount++;
        } catch (err) {
          console.error(`Failed to import problem "${slug}":`, err.message);
          failedCount++;
        }
      }
      
      res.json({ 
        success: true, 
        solved: solvedCount,
        alreadyExists: alreadyExistsCount,
        failed: failedCount,
        total: Object.keys(solvedMap).length
      });
    } catch (error) {
      console.error('LeetCode Import Error:', error);
      res.status(500).json({ error: 'Failed to import from LeetCode' });
    }
  });

  router.post('/sync', auth, async (req, res) => {
    try {
      const user = await getItem(`USER#${req.userId}`, 'PROFILE');
      if (!user) return res.status(404).json({ error: 'User not found' });
      
      const username = user.leetcodeUsername?.trim();
      if (!username) {
        return res.status(400).json({ error: 'LeetCode username not set in profile' });
      }

      const solvedSlugs = new Set();
      const dateMap = new Map();

      const accepted = await fetchAcceptedProblemData(username);
      accepted.forEach((problem) => solvedSlugs.add(problem.titleSlug));

      try {
        const recentSubmissions = await fetchRecentAcceptedSubmissionDates(username);
        recentSubmissions.forEach((submission) => {
          if (submission.statusDisplay === 'Accepted' && !dateMap.has(submission.titleSlug)) {
            dateMap.set(submission.titleSlug, new Date(parseInt(submission.timestamp, 10) * 1000).toISOString());
          }
        });
      } catch (err) {
        // Exact timestamps are optional for instant sync, so keep going if this secondary query fails.
        console.error('Recent submission sync warning:', err.message);
      }

      const defaultTimestamp = new Date().toISOString();
      let newlyImported = 0;
      let alreadyTracked = 0;

      for (const slug of solvedSlugs) {
        const problemData = getProblemBySlug(slug);
        if (problemData) {
          const num = problemData.number;
          const ts = dateMap.get(slug) || defaultTimestamp;
          await ensureProblemExists(problemData, req.userId);
          const result = await updateProgress(req.userId, num, 'solved', ts);
          if (result === 'solved') newlyImported++;
          else alreadyTracked++;
        }
      }

      res.json({ 
        success: true, 
        newlyImported, 
        alreadyTracked, 
        totalFound: solvedSlugs.size 
      });
    } catch (error) {
      console.error('LeetCode Sync Error:', error);
      const statusCode = error.statusCode || 500;
      const errorMessage = statusCode === 404
        ? 'Could not find a public LeetCode profile for that username. Check the username and profile privacy.'
        : 'Failed to sync from LeetCode';
      res.status(statusCode).json({ error: errorMessage });
    }
  });

  return router;
};

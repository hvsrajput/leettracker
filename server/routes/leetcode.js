const express = require('express');
const axios = require('axios');
const { auth } = require('../middleware/auth');
const { putItem, getItem, queryItems } = require('../db/dynamodb');
const { getProblemBySlug } = require('../utils/problemsDataset');

const router = express.Router();
const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';
const LEETCODE_HEADERS = {
  'Content-Type': 'application/json',
  'Referer': 'https://leetcode.com',
  'Origin': 'https://leetcode.com',
  'User-Agent': 'Mozilla/5.0',
};

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
    const resp = await axios.post(LEETCODE_GRAPHQL_URL, {
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

async function resolveProblemData(titleSlug) {
  return getProblemBySlug(titleSlug) || await fetchProblemFromLeetCode(titleSlug);
}

function toIsoTimestamp(unixTimestamp, fallbackTimestamp = new Date().toISOString()) {
  const parsed = Number.parseInt(unixTimestamp, 10);
  return Number.isFinite(parsed) ? new Date(parsed * 1000).toISOString() : fallbackTimestamp;
}

function isAcceptedSubmission(submission) {
  return submission?.statusDisplay === 'Accepted' || submission?.status === 10;
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
    query userPublicProfile($username: String!) {
      matchedUser(username: $username) {
        username
        submitStatsGlobal {
          acSubmissionNum {
            difficulty
            count
            submissions
          }
        }
      }
    }
  `;

  const response = await axios.post(LEETCODE_GRAPHQL_URL, {
    query: profileQuery,
    variables: { username }
  }, {
    headers: LEETCODE_HEADERS,
    timeout: 10000
  });

  if (response.data?.errors?.length) {
    throw new Error(response.data.errors[0].message || 'LeetCode profile lookup failed');
  }

  const profile = response.data?.data?.matchedUser;
  if (!profile) {
    const error = new Error('Could not find a public LeetCode profile for that username');
    error.statusCode = 404;
    throw error;
  }

  const totalSolved = profile.submitStatsGlobal?.acSubmissionNum?.find(
    (item) => item.difficulty === 'All'
  )?.count || 0;

  return {
    username: profile.username,
    totalSolved,
  };
}

async function fetchRecentAcceptedSubmissionDates(username) {
  const subQuery = `
    query recentAcSubmissionList($username: String!, $limit: Int!) {
      recentAcSubmissionList(username: $username, limit: $limit) {
        title
        titleSlug
        timestamp
      }
    }
  `;

  const response = await axios.post(LEETCODE_GRAPHQL_URL, {
    query: subQuery,
    variables: { username, limit: 50 }
  }, {
    headers: LEETCODE_HEADERS,
    timeout: 5000
  });

  if (response.data?.errors?.length) {
    throw new Error(response.data.errors[0].message || 'Failed to fetch recent submissions');
  }

  return response.data?.data?.recentAcSubmissionList || [];
}

async function fetchRecentSubmissionActivity(username) {
  const recentSubmissionQuery = `
    query recentSubmissionList($username: String!, $limit: Int!) {
      recentSubmissionList(username: $username, limit: $limit) {
        title
        titleSlug
        status
        statusDisplay
        timestamp
      }
    }
  `;

  const response = await axios.post(LEETCODE_GRAPHQL_URL, {
    query: recentSubmissionQuery,
    variables: { username, limit: 20 }
  }, {
    headers: LEETCODE_HEADERS,
    timeout: 5000
  });

  if (response.data?.errors?.length) {
    throw new Error(response.data.errors[0].message || 'Failed to fetch recent submission activity');
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
          let problemData = await resolveProblemData(slug);
          
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

      const [
        { totalSolved },
        recentAcceptedSubmissions,
        recentSubmissions,
      ] = await Promise.all([
        fetchAcceptedProblemData(username),
        fetchRecentAcceptedSubmissionDates(username),
        fetchRecentSubmissionActivity(username),
      ]);

      const recentSolvedMap = new Map();
      recentAcceptedSubmissions.forEach((submission) => {
        if (!submission?.titleSlug || recentSolvedMap.has(submission.titleSlug)) {
          return;
        }

        recentSolvedMap.set(
          submission.titleSlug,
          toIsoTimestamp(submission.timestamp)
        );
      });

      const recentAttemptedMap = new Map();
      recentSubmissions.forEach((submission) => {
        if (!submission?.titleSlug) {
          return;
        }

        if (isAcceptedSubmission(submission) || recentSolvedMap.has(submission.titleSlug)) {
          return;
        }

        if (!recentAttemptedMap.has(submission.titleSlug)) {
          recentAttemptedMap.set(
            submission.titleSlug,
            toIsoTimestamp(submission.timestamp)
          );
        }
      });

      const defaultTimestamp = new Date().toISOString();
      let newlyImported = 0;
      let attemptedImported = 0;
      let alreadyTracked = 0;
      let failed = 0;

      for (const [slug, timestamp] of recentSolvedMap.entries()) {
        const problemData = await resolveProblemData(slug);
        if (problemData) {
          const num = problemData.number;
          const ts = timestamp || defaultTimestamp;
          await ensureProblemExists(problemData, req.userId);
          const result = await updateProgress(req.userId, num, 'solved', ts);
          if (result === 'solved') newlyImported++;
          else alreadyTracked++;
        } else {
          failed++;
        }
      }

      for (const [slug, timestamp] of recentAttemptedMap.entries()) {
        const problemData = await resolveProblemData(slug);
        if (problemData) {
          const num = problemData.number;
          const ts = timestamp || defaultTimestamp;
          await ensureProblemExists(problemData, req.userId);
          const result = await updateProgress(req.userId, num, 'attempted', ts);
          if (result === 'attempted') attemptedImported++;
          else alreadyTracked++;
        } else {
          failed++;
        }
      }

      res.json({ 
        success: true, 
        newlyImported, 
        attemptedImported,
        alreadyTracked, 
        failed,
        totalFound: recentSolvedMap.size + recentAttemptedMap.size,
        totalSolvedOnLeetCode: totalSolved,
        recentSolvedFound: recentSolvedMap.size,
        recentAttemptedFound: recentAttemptedMap.size,
        bestEffortAttempted: true,
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

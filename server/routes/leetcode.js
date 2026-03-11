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

module.exports = function () {
  router.post('/import', auth, async (req, res) => {
    const { username, sessionCookie } = req.body;
    if (!username && !sessionCookie) {
      return res.status(400).json({ error: 'LeetCode username or Session Cookie is required' });
    }

    try {
      // Build a map: slug -> { bestStatus, timestamp }
      const submissionMap = new Map();
      
      if (sessionCookie) {
        const cookieHeader = sessionCookie.includes('LEETCODE_SESSION=')
          ? sessionCookie
          : `LEETCODE_SESSION=${sessionCookie}`;

        // Extract csrftoken from the cookie string
        let csrfToken = '';
        const csrfMatch = cookieHeader.match(/csrftoken=([^;\s]+)/);
        if (csrfMatch) csrfToken = csrfMatch[1];

        const headers = {
          'Content-Type': 'application/json',
          'Cookie': cookieHeader,
          'Referer': 'https://leetcode.com',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ...(csrfToken && { 'x-csrftoken': csrfToken }),
        };

        // Query loop for paginated submissions
        const query = `
        query submissionList($offset: Int!, $limit: Int!) {
          submissionList(offset: $offset, limit: $limit) {
            hasNext
            submissions {
              titleSlug
              statusDisplay
            }
          }
        }
      `;

      let offset = 0;
      const limit = 50;
      let hasNext = true;
      const solvedSlugs = new Set();
      let failedAuth = false;

      while (hasNext) {
        let graphqlResp;
        try {
          graphqlResp = await axios.post('https://leetcode.com/graphql', {
            query,
            variables: { offset, limit }
          }, {
            headers,
            timeout: 10000
          });
        } catch (err) {
          if (err.response && (err.response.status === 401 || err.response.status === 403)) {
            failedAuth = true;
            break;
          }
          console.error("GraphQL Pagination Error:", err.message);
          break;
        }

        const data = graphqlResp.data?.data;
        if (!data || graphqlResp.data?.errors) {
          failedAuth = true;
          break;
        }

        const list = data.submissionList;
        if (list && list.submissions) {
          for (const sub of list.submissions) {
            if (sub.statusDisplay === 'Accepted') {
              solvedSlugs.add(sub.titleSlug);
            }
          }
          hasNext = list.hasNext;
          offset += limit;
          
          if (hasNext) {
            await new Promise(r => setTimeout(r, 300));
          }
        } else {
          hasNext = false;
        }
      }

      if (failedAuth) {
        return res.status(401).json({ error: 'LeetCode session expired or invalid. Please re-import cookies.' });
      }

      const timestamp = new Date().toISOString();

      let solvedCount = 0;
      let attemptedCount = 0;
      let alreadyExistsCount = 0;
      let failedCount = 0;

      for (const slug of solvedSlugs) {
        try {
          // Strict mapping against problems.json dataset
          let problemData = datasetMapBySlug.get(slug);
          
          if (!problemData) {
            failedCount++; // Problem not in dataset
            continue;
          }

          const num = problemData.number;

          await ensureProblemExists(problemData, req.userId);
          
          const result = await updateProgress(req.userId, num, 'solved', timestamp);
          if (result === 'solved') solvedCount++;
          else alreadyExistsCount++;
        } catch (err) {
          console.error(`Failed to import problem "${slug}":`, err.message);
          failedCount++;
        }
      }

      }
      
      res.json({ 
        success: true, 
        solved: solvedCount,
        alreadyExists: alreadyExistsCount,
        failed: failedCount,
        total: solvedSlugs.size
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
      
      const username = user.leetcodeUsername;
      if (!username) {
        return res.status(400).json({ error: 'LeetCode username not set in profile' });
      }

      // Query loop for paginated submissions
      const query = `
        query submissionList($offset: Int!, $limit: Int!) {
          submissionList(offset: $offset, limit: $limit) {
            hasNext
            submissions {
              titleSlug
              statusDisplay
            }
          }
        }
      `;

      let offset = 0;
      const limit = 50;
      let hasNext = true;
      const solvedSlugs = new Set();
      
      while (hasNext) {
        let graphqlResp;
        try {
          graphqlResp = await axios.post('https://leetcode.com/graphql', {
            query,
            variables: { offset, limit, username }
          }, {
            headers: { 'Content-Type': 'application/json', 'Referer': 'https://leetcode.com' },
            timeout: 10000
          });
        } catch (err) {
          console.error("GraphQL Sync Pagination Error:", err.message);
          break;
        }

        const data = graphqlResp.data?.data;
        if (!data || graphqlResp.data?.errors) {
          break;
        }

        const list = data.submissionList;
        if (list && list.submissions) {
          for (const sub of list.submissions) {
            if (sub.statusDisplay === 'Accepted') {
              solvedSlugs.add(sub.titleSlug);
            }
          }
          hasNext = list.hasNext;
          offset += limit;
        } else {
          hasNext = false;
        }
      }

      const timestamp = new Date().toISOString();
      let solvedCount = 0;
      let attemptedCount = 0;

      for (const slug of solvedSlugs) {
        const problemData = datasetMapBySlug.get(slug);
        if (problemData) {
          const num = problemData.number;
          await ensureProblemExists(problemData, req.userId);
          const result = await updateProgress(req.userId, num, 'solved', timestamp);
          if (result === 'solved') solvedCount++;
        }
      }

      res.json({ success: true, solved: solvedCount, attempted: attemptedCount });
    } catch (error) {
      console.error('LeetCode Sync Error:', error);
      res.status(500).json({ error: 'Failed to sync from LeetCode' });
    }
  });

  return router;
};

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
        // Authenticated REST API (Bypasses 20-item public limit)
        let offset = 0;
        let limit = 20;
        let hasNext = true;
        
        const cookieHeader = sessionCookie.includes('LEETCODE_SESSION=') 
          ? sessionCookie 
          : `LEETCODE_SESSION=${sessionCookie}`;
        
        let csrfToken = '';
        const csrfMatch = cookieHeader.match(/csrftoken=([^;\s]+)/);
        if (csrfMatch) {
          csrfToken = csrfMatch[1];
        } else {
          try {
            const csrfResp = await axios.get('https://leetcode.com', {
              headers: { 'Cookie': cookieHeader },
              maxRedirects: 0,
              validateStatus: () => true,
            });
            const setCookies = csrfResp.headers['set-cookie'] || [];
            for (const sc of setCookies) {
              const m = sc.match(/csrftoken=([^;]+)/);
              if (m) { csrfToken = m[1]; break; }
            }
          } catch (e) {
            console.error('Failed to fetch CSRF token:', e.message);
          }
        }
        
        const fullCookie = csrfToken && !cookieHeader.includes('csrftoken=')
          ? `${cookieHeader}; csrftoken=${csrfToken}`
          : cookieHeader;
        
        while (hasNext) {
          try {
            const headers = {
              'Cookie': fullCookie,
              'Referer': 'https://leetcode.com',
              'User-Agent': 'Mozilla/5.0',
            };
            if (csrfToken) {
              headers['x-csrftoken'] = csrfToken;
            }

            const subResp = await axios.get(`https://leetcode.com/api/submissions/?offset=${offset}&limit=${limit}`, {
              headers,
              timeout: 15000
            });
            const dump = subResp.data.submissions_dump || [];
            
            for (const sub of dump) {
              const slug = sub.title_slug;
              const isAccepted = sub.status_display === 'Accepted';
              const existing = submissionMap.get(slug);
              
              // Solved always wins
              if (!existing) {
                submissionMap.set(slug, {
                  titleSlug: slug,
                  timestamp: sub.timestamp,
                  status: isAccepted ? 'solved' : 'attempted'
                });
              } else if (isAccepted && existing.status !== 'solved') {
                existing.status = 'solved';
                existing.timestamp = sub.timestamp;
              }
            }
            
            if (dump.length === 0) hasNext = false;
            else hasNext = subResp.data.has_next;
            offset += limit;
          } catch (err) {
            console.error('REST API Submissions error:', err.message);
            // If rate limited, we wait and try one more time before breaking
            if (err.response && err.response.status === 429) {
              console.log('Rate limited, waiting 2s...');
              await new Promise(r => setTimeout(r, 2000));
              try {
                const subRespRetry = await axios.get(`https://leetcode.com/api/submissions/?offset=${offset}&limit=${limit}`, {
                  headers, timeout: 15000
                });
                const dumpRetry = subRespRetry.data.submissions_dump || [];
                for (const sub of dumpRetry) {
                  const slug = sub.title_slug;
                  const isAccepted = sub.status_display === 'Accepted';
                  const existing = submissionMap.get(slug);
                  if (!existing) {
                    submissionMap.set(slug, { titleSlug: slug, timestamp: sub.timestamp, status: isAccepted ? 'solved' : 'attempted' });
                  } else if (isAccepted && existing.status !== 'solved') {
                    existing.status = 'solved';
                    existing.timestamp = sub.timestamp;
                  }
                }
                if (dumpRetry.length === 0) hasNext = false;
                else hasNext = subRespRetry.data.has_next;
                offset += limit;
              } catch (e2) {
                console.error('Retry failed:', e2.message);
                break;
              }
            } else {
              break; 
            }
          }
        }
      } else {
        // Public GraphQL API — fetch BOTH AC and recent submissions
        // 1. Fetch accepted submissions
        const acQuery = `
          query getUserProfile($username: String!) {
            recentAcSubmissionList(username: $username, limit: 500) {
              titleSlug
              timestamp
            }
          }
        `;
        const acResp = await axios.post('https://leetcode.com/graphql', {
          query: acQuery,
          variables: { username }
        }, {
          headers: { 'Content-Type': 'application/json', 'Referer': 'https://leetcode.com' }
        });
        
        const acSubs = acResp.data?.data?.recentAcSubmissionList || [];
        for (const sub of acSubs) {
          submissionMap.set(sub.titleSlug, {
            titleSlug: sub.titleSlug,
            timestamp: sub.timestamp,
            status: 'solved'
          });
        }
        
        // 2. Fetch recent submissions (all statuses) to find attempted
        const recentQuery = `
          query getRecentSubmissions($username: String!, $limit: Int!) {
            recentSubmissionList(username: $username, limit: $limit) {
              titleSlug
              timestamp
              statusDisplay
            }
          }
        `;
        const recentResp = await axios.post('https://leetcode.com/graphql', {
          query: recentQuery,
          variables: { username, limit: 500 }
        }, {
          headers: { 'Content-Type': 'application/json', 'Referer': 'https://leetcode.com' }
        });
        
        const recentSubs = recentResp.data?.data?.recentSubmissionList || [];
        for (const sub of recentSubs) {
          const existing = submissionMap.get(sub.titleSlug);
          if (!existing) {
            // Not in AC list → attempted
            submissionMap.set(sub.titleSlug, {
              titleSlug: sub.titleSlug,
              timestamp: sub.timestamp,
              status: sub.statusDisplay === 'Accepted' ? 'solved' : 'attempted'
            });
          }
          // If already marked solved, don't downgrade
        }
      }

      let solvedCount = 0;
      let attemptedCount = 0;
      let alreadyExistsCount = 0;
      let failedCount = 0;

      for (const [slug, sub] of submissionMap) {
        try {
          let problemData = datasetMapBySlug.get(slug);
          
          if (!problemData) {
            problemData = await fetchProblemFromLeetCode(slug);
            if (!problemData) {
              failedCount++;
              continue;
            }
          }

          const num = problemData.number;
          const ts = new Date(parseInt(sub.timestamp) * 1000).toISOString();

          await ensureProblemExists(problemData, req.userId);
          
          const result = await updateProgress(req.userId, num, sub.status, ts);
          if (result === 'solved') solvedCount++;
          else if (result === 'attempted') attemptedCount++;
          else alreadyExistsCount++;
        } catch (err) {
          console.error(`Failed to import problem "${slug}":`, err.message);
          failedCount++;
        }
      }

      res.json({ 
        success: true, 
        solved: solvedCount,
        attempted: attemptedCount,
        alreadyExists: alreadyExistsCount,
        failed: failedCount,
        total: submissionMap.size
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

      const submissionMap = new Map();

      // 1. Fetch accepted submissions
      const acQuery = `
        query getUserProfile($username: String!) {
          recentAcSubmissionList(username: $username, limit: 500) {
            titleSlug
            timestamp
          }
        }
      `;
      const acResp = await axios.post('https://leetcode.com/graphql', {
        query: acQuery,
        variables: { username }
      }, {
        headers: { 'Content-Type': 'application/json', 'Referer': 'https://leetcode.com' }
      });
      
      const acSubs = acResp.data?.data?.recentAcSubmissionList || [];
      for (const sub of acSubs) {
        submissionMap.set(sub.titleSlug, {
          titleSlug: sub.titleSlug,
          timestamp: sub.timestamp,
          status: 'solved'
        });
      }
      
      // 2. Fetch recent submissions (all statuses) for attempted
      const recentQuery = `
        query getRecentSubmissions($username: String!, $limit: Int!) {
          recentSubmissionList(username: $username, limit: $limit) {
            titleSlug
            timestamp
            statusDisplay
          }
        }
      `;
      const recentResp = await axios.post('https://leetcode.com/graphql', {
        query: recentQuery,
        variables: { username, limit: 500 }
      }, {
        headers: { 'Content-Type': 'application/json', 'Referer': 'https://leetcode.com' }
      });
      
      const recentSubs = recentResp.data?.data?.recentSubmissionList || [];
      for (const sub of recentSubs) {
        const existing = submissionMap.get(sub.titleSlug);
        if (!existing) {
          submissionMap.set(sub.titleSlug, {
            titleSlug: sub.titleSlug,
            timestamp: sub.timestamp,
            status: sub.statusDisplay === 'Accepted' ? 'solved' : 'attempted'
          });
        }
      }

      let solvedCount = 0;
      let attemptedCount = 0;

      for (const [slug, sub] of submissionMap) {
        const problemData = datasetMapBySlug.get(slug);
        if (problemData) {
          const num = problemData.number;
          const ts = new Date(parseInt(sub.timestamp) * 1000).toISOString();

          await ensureProblemExists(problemData, req.userId);
          const result = await updateProgress(req.userId, num, sub.status, ts);
          if (result === 'solved') solvedCount++;
          else if (result === 'attempted') attemptedCount++;
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

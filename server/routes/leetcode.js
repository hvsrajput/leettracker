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
        let limit = 20;
        let hasNext = true;
        
        // Build cookie header
        const cookieHeader = sessionCookie.includes('LEETCODE_SESSION=') 
          ? sessionCookie 
          : `LEETCODE_SESSION=${sessionCookie}`;
        
        // Extract csrftoken if present in the cookie string
        let csrfToken = '';
        const csrfMatch = cookieHeader.match(/csrftoken=([^;\s]+)/);
        if (csrfMatch) {
          csrfToken = csrfMatch[1];
        } else {
          // If no csrftoken in cookie, fetch one from leetcode.com first
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
              if (sub.status_display === 'Accepted') {
                // Deduplicate by slug (keep first = most recent)
                if (!recentSubs.find(s => s.titleSlug === sub.title_slug)) {
                  recentSubs.push({
                    titleSlug: sub.title_slug,
                    timestamp: sub.timestamp
                  });
                }
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
            recentAcSubmissionList(username: $username, limit: 500) {
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
      let alreadyExistsCount = 0;
      let failedCount = 0;

      for (const sub of recentSubs) {
        try {
          // Try local dataset first, then fetch from LeetCode API
          let problemData = datasetMapBySlug.get(sub.titleSlug);
          
          if (!problemData) {
            // Fetch from LeetCode GraphQL API
            problemData = await fetchProblemFromLeetCode(sub.titleSlug);
            if (!problemData) {
              failedCount++;
              continue;
            }
          }

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
              url: problemData.url || `https://leetcode.com/problems/${problemData.slug}/`,
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
          } else {
            alreadyExistsCount++;
          }
        } catch (err) {
          console.error(`Failed to import problem "${sub.titleSlug}":`, err.message);
          failedCount++;
        }
      }

      res.json({ 
        success: true, 
        imported: importedCount, 
        alreadyExists: alreadyExistsCount,
        failed: failedCount,
        total: recentSubs.length
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

      const leetcodeQuery = `
        query getUserProfile($username: String!) {
          recentAcSubmissionList(username: $username, limit: 500) {
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

      res.json({ success: true, imported: importedCount });
    } catch (error) {
      console.error('LeetCode Sync Error:', error);
      res.status(500).json({ error: 'Failed to sync from LeetCode' });
    }
  });

  return router;
};

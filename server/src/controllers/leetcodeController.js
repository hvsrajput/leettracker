import axios from 'axios';
import { putItem, getItem, queryItems } from '../db/dynamodb.js';
import { getProblemBySlug } from '../utils/problemsDataset.js';

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';
const LEETCODE_HEADERS = {
  'Content-Type': 'application/json',
  'Referer': 'https://leetcode.com',
  'Origin': 'https://leetcode.com',
  'User-Agent': 'Mozilla/5.0',
};

// Helper: fetch problem metadata from LeetCode GraphQL by titleSlug
const fetchProblemFromLeetCode = async (titleSlug) => {
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
};

// Helper: resolve problem data from local dataset, falling back to LeetCode GraphQL
const resolveProblemData = async (titleSlug) => {
  return getProblemBySlug(titleSlug) || await fetchProblemFromLeetCode(titleSlug);
};

const toIsoTimestamp = (unixTimestamp, fallbackTimestamp = new Date().toISOString()) => {
  const parsed = Number.parseInt(unixTimestamp, 10);
  return Number.isFinite(parsed) ? new Date(parsed * 1000).toISOString() : fallbackTimestamp;
};

const isAcceptedSubmission = (submission) => {
  return submission?.statusDisplay === 'Accepted' || submission?.status === 10;
};

// Helper: ensure problem exists in DB, create if not
const ensureProblemExists = async (problemData, userId) => {
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
};

// Helper: update progress with priority logic (solved > attempted > unsolved, never downgrade)
const updateProgress = async (userId, num, newStatus, timestamp) => {
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
};

// Helper: add imported problem numbers to specified groups (with membership check)
const addProblemsToGroups = async (userId, problemNumbers, groupIds) => {
  if (!Array.isArray(groupIds) || groupIds.length === 0 || problemNumbers.length === 0) {
    return { groupsUpdated: 0, groupsFailed: 0 };
  }

  let groupsUpdated = 0;
  let groupsFailed = 0;
  const addedAt = new Date().toISOString();

  for (const groupId of groupIds) {
    try {
      // Validate membership
      const membership = await getItem(`GROUP#${groupId}`, `MEMBER#${userId}`);
      if (!membership) {
        groupsFailed++;
        continue;
      }

      // Get existing problems in group to avoid duplicates
      const existingGroupProblems = await queryItems(`GROUP#${groupId}`, 'PROBLEM#');
      const existingIds = new Set(
        existingGroupProblems.map((item) => parseInt(item.SK.replace('PROBLEM#', ''), 10))
      );

      let addedCount = 0;
      for (const num of problemNumbers) {
        if (existingIds.has(num)) continue;
        await putItem({
          PK: `GROUP#${groupId}`,
          SK: `PROBLEM#${num}`,
          addedBy: userId,
          addedAt,
        });
        addedCount++;
      }

      if (addedCount > 0) groupsUpdated++;
    } catch (err) {
      console.error(`Failed to add problems to group ${groupId}:`, err.message);
      groupsFailed++;
    }
  }

  return { groupsUpdated, groupsFailed };
};

// Helper: fetch a public profile's accepted-submission totals
const fetchAcceptedProblemData = async (username) => {
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
};

// Helper: fetch recent accepted submissions for a public profile
const fetchRecentAcceptedSubmissionDates = async (username) => {
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
};

// Helper: fetch recent submission activity (all statuses) for a public profile
const fetchRecentSubmissionActivity = async (username) => {
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
};

/**
 * @name importFromLeetCodeController
 * @description Import solved/attempted problem maps pasted by the user
 * @access Private
 */
export const importFromLeetCode = async (req, res) => {
  const hasStructuredPayload = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    && ('solvedMap' in req.body || 'attemptedMap' in req.body);
  const solvedMap = hasStructuredPayload ? (req.body.solvedMap || {}) : (req.body || {});
  const attemptedMap = hasStructuredPayload ? (req.body.attemptedMap || {}) : {};
  const groupIds = Array.isArray(req.body?.groupIds) ? req.body.groupIds : [];

  const isSolvedMapValid = solvedMap && typeof solvedMap === 'object' && !Array.isArray(solvedMap);
  const isAttemptedMapValid = attemptedMap && typeof attemptedMap === 'object' && !Array.isArray(attemptedMap);
  const solvedEntries = isSolvedMapValid ? Object.entries(solvedMap) : [];
  const attemptedEntries = isAttemptedMapValid ? Object.entries(attemptedMap) : [];

  if (!isSolvedMapValid || !isAttemptedMapValid || (solvedEntries.length === 0 && attemptedEntries.length === 0)) {
    return res.status(400).json({ error: 'Import data is required. Please follow the import instructions.' });
  }

  try {
    let solvedCount = 0;
    let attemptedCount = 0;
    let alreadyExistsCount = 0;
    let failedCount = 0;
    const importedProblemNumbers = [];

    for (const [slug, unixTimestamp] of solvedEntries) {
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
        if (result === 'solved') {
          solvedCount++;
          importedProblemNumbers.push(num);
        } else {
          alreadyExistsCount++;
        }
      } catch (err) {
        console.error(`Failed to import problem "${slug}":`, err.message);
        failedCount++;
      }
    }

    for (const [slug, unixTimestamp] of attemptedEntries) {
      try {
        const problemData = await resolveProblemData(slug);

        if (!problemData) {
          failedCount++;
          continue;
        }

        const num = problemData.number;
        const ts = toIsoTimestamp(unixTimestamp);

        await ensureProblemExists(problemData, req.userId);

        const result = await updateProgress(req.userId, num, 'attempted', ts);
        if (result === 'attempted') {
          attemptedCount++;
          importedProblemNumbers.push(num);
        } else {
          alreadyExistsCount++;
        }
      } catch (err) {
        console.error(`Failed to import attempted problem "${slug}":`, err.message);
        failedCount++;
      }
    }

    // Add imported problems to selected groups
    const { groupsUpdated, groupsFailed } = await addProblemsToGroups(
      req.userId, importedProblemNumbers, groupIds
    );

    res.json({
      success: true,
      solved: solvedCount,
      attempted: attemptedCount,
      alreadyExists: alreadyExistsCount,
      failed: failedCount,
      total: solvedEntries.length + attemptedEntries.length,
      groupsUpdated,
      groupsFailed,
    });
  } catch (error) {
    console.error('LeetCode Import Error:', error);
    res.status(500).json({ error: 'Failed to import from LeetCode' });
  }
};

/**
 * @name syncFromLeetCodeController
 * @description Sync recent activity from the user's public LeetCode profile
 * @access Private
 */
export const syncFromLeetCode = async (req, res) => {
  try {
    const groupIds = Array.isArray(req.body?.groupIds) ? req.body.groupIds : [];

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
    const importedProblemNumbers = [];

    for (const [slug, timestamp] of recentSolvedMap.entries()) {
      const problemData = await resolveProblemData(slug);
      if (problemData) {
        const num = problemData.number;
        const ts = timestamp || defaultTimestamp;
        await ensureProblemExists(problemData, req.userId);
        const result = await updateProgress(req.userId, num, 'solved', ts);
        if (result === 'solved') {
          newlyImported++;
          importedProblemNumbers.push(num);
        } else {
          alreadyTracked++;
        }
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
        if (result === 'attempted') {
          attemptedImported++;
          importedProblemNumbers.push(num);
        } else {
          alreadyTracked++;
        }
      } else {
        failed++;
      }
    }

    // Add imported problems to selected groups
    const { groupsUpdated, groupsFailed } = await addProblemsToGroups(
      req.userId, importedProblemNumbers, groupIds
    );

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
      groupsUpdated,
      groupsFailed,
    });
  } catch (error) {
    console.error('LeetCode Sync Error:', error);
    const statusCode = error.statusCode || 500;
    const errorMessage = statusCode === 404
      ? 'Could not find a public LeetCode profile for that username. Check the username and profile privacy.'
      : 'Failed to sync from LeetCode';
    res.status(statusCode).json({ error: errorMessage });
  }
};

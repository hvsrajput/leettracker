import { queryItems, getItem, batchGetItems } from '../db/dynamodb.js';
import { getProblemByNumber } from '../utils/problemsDataset.js';

// Helper: whether a progress record counts as solved
const isSolvedProgress = (progress) => {
  if (!progress) {
    return false;
  }

  if (typeof progress === 'boolean') {
    return progress;
  }

  return progress.status === 'solved' || progress.solved === 1;
};

// Helper: topics for a tracked problem (dataset first, pattern fallback)
const getTrackedProblemTopics = (problem) => {
  const datasetEntry = getProblemByNumber(problem.leetcodeNumber);
  const topics = datasetEntry?.topics?.length
    ? datasetEntry.topics
    : (problem.patternName ? [problem.patternName] : []);

  return [...new Set((topics || []).filter(Boolean))];
};

// Helper: best-known LeetCode URL for a problem
const getLeetCodeProblemUrl = (problem) => {
  const datasetEntry = getProblemByNumber(problem.leetcodeNumber);
  const slug = problem.slug || datasetEntry?.slug;

  return problem.url
    || datasetEntry?.url
    || (slug ? `https://leetcode.com/problems/${slug}/` : 'https://leetcode.com/problemset/');
};

const comparePatternStrengthDesc = (a, b) => {
  return b.percent - a.percent
    || b.solved - a.solved
    || b.total - a.total
    || a.pattern.localeCompare(b.pattern);
};

const comparePatternWeaknessAsc = (a, b) => {
  return a.percent - b.percent
    || b.total - a.total
    || a.pattern.localeCompare(b.pattern);
};

// Helper: build pattern stats and strongest/weakest/neglected heatmap
const buildPatternInsights = (trackedProblems, progressMap) => {
  const patternMap = {};

  trackedProblems.forEach((problem) => {
    const topics = getTrackedProblemTopics(problem);
    const isSolved = isSolvedProgress(progressMap[String(problem.leetcodeNumber)]);

    topics.forEach((topic) => {
      if (!patternMap[topic]) {
        patternMap[topic] = { name: topic, total: 0, solved: 0 };
      }

      patternMap[topic].total += 1;
      if (isSolved) {
        patternMap[topic].solved += 1;
      }
    });
  });

  const patternStats = Object.values(patternMap)
    .sort((a, b) => a.name.localeCompare(b.name));

  const allPatterns = patternStats
    .map((pattern) => ({
      pattern: pattern.name,
      solved: pattern.solved,
      total: pattern.total,
      percent: pattern.total > 0 ? Math.round((pattern.solved / pattern.total) * 100) : 0,
    }))
    .sort(comparePatternStrengthDesc);

  const strongest = allPatterns[0] || null;

  const weakestCandidates = allPatterns
    .filter((pattern) => pattern.solved > 0)
    .sort(comparePatternWeaknessAsc);
  const weakest = weakestCandidates[0]
    || [...allPatterns].sort(comparePatternWeaknessAsc)[0]
    || null;

  const neglectedCandidates = allPatterns
    .filter((pattern) => pattern.solved === 0)
    .sort((a, b) => b.total - a.total || a.pattern.localeCompare(b.pattern));
  const neglected = neglectedCandidates[0] || null;

  return {
    patternStats,
    patternHeatmap: {
      strongest,
      weakest,
      neglected,
      allPatterns,
    },
  };
};

/**
 * @name getDashboardController
 * @description Get the user's dashboard summary (totals, pattern/difficulty/group stats, recent activity, heatmap)
 * @access Private
 */
export const getDashboard = async (req, res) => {
  try {
    // Get user progress
    const progressItems = await queryItems(`PROGRESS#${req.userId}`, 'PROB#');
    const progressMap = {};
    progressItems.forEach(p => {
      const lcNum = p.SK.replace('PROB#', '');
      const status = p.status || (p.solved === 1 ? 'solved' : 'unsolved');
      progressMap[lcNum] = { solved: p.solved, solvedAt: p.solvedAt, status };
    });

    const trackedProblems = await batchGetItems(
      Object.keys(progressMap).map((lcNum) => ({
        PK: `PROBLEM#${lcNum}`,
        SK: 'DETAIL',
      }))
    );
    const problemsById = new Map(
      trackedProblems.map((problem) => [String(problem.leetcodeNumber), problem])
    );

    const totalProblems = trackedProblems.length;
    let totalSolved = 0;
    let totalAttempted = 0;

    // Pattern-wise and difficulty-wise breakdown
    const difficultyMap = {};

    trackedProblems.forEach(p => {
      const progress = progressMap[String(p.leetcodeNumber)];
      const status = progress?.status || 'unsolved';
      const isSolved = status === 'solved';
      const isAttempted = status === 'attempted';
      if (isSolved) totalSolved++;
      if (isAttempted) totalAttempted++;

      // Difficulty stats
      if (p.difficulty) {
        if (!difficultyMap[p.difficulty]) {
          difficultyMap[p.difficulty] = { difficulty: p.difficulty, total: 0, solved: 0 };
        }
        difficultyMap[p.difficulty].total++;
        if (isSolved) difficultyMap[p.difficulty].solved++;
      }
    });

    const { patternStats, patternHeatmap } = buildPatternInsights(trackedProblems, progressMap);
    const difficultyStats = Object.values(difficultyMap);
    // Group progress
    const userGroups = await queryItems(`USERGROUP#${req.userId}`, 'GROUP#');
    const groupStats = (await Promise.all(userGroups.map(async (ug) => {
      const groupId = ug.SK.replace('GROUP#', '');
      const [detail, groupProblems, memberItems] = await Promise.all([
        getItem(`GROUP#${groupId}`, 'DETAIL'),
        queryItems(`GROUP#${groupId}`, 'PROBLEM#'),
        queryItems(`GROUP#${groupId}`, 'MEMBER#'),
      ]);

      if (!detail) {
        return null;
      }

      const solvedCount = groupProblems.reduce((count, gp) => {
        const lcNum = gp.SK.replace('PROBLEM#', '');
        return count + (progressMap[lcNum]?.solved === 1 ? 1 : 0);
      }, 0);

      return {
        id: groupId,
        name: detail.name,
        total_problems: groupProblems.length,
        solved_problems: solvedCount,
        member_count: memberItems.length,
      };
    }))).filter(Boolean);

    // Recent activity — filter progress for solved items and sort
    const recentSolved = [];
    for (const [lcNum, prog] of Object.entries(progressMap)) {
      if (prog.solved === 1) {
        const problem = problemsById.get(lcNum);
        if (problem) {
          recentSolved.push({
            leetcode_number: problem.leetcodeNumber,
            title: problem.title,
            difficulty: problem.difficulty,
            url: getLeetCodeProblemUrl(problem),
            solved_at: prog.solvedAt,
          });
        }
      }
    }
    recentSolved.sort((a, b) => new Date(b.solved_at) - new Date(a.solved_at));

    const heatmapData = {};
    progressItems.forEach((progress) => {
      if (progress.solved === 1 && progress.solvedAt) {
        const dateStr = progress.solvedAt.split('T')[0];
        heatmapData[dateStr] = (heatmapData[dateStr] || 0) + 1;
      }
    });

    res.json({
      totalSolved,
      totalAttempted,
      totalProblems,
      patternStats,
      difficultyStats,
      groupStats,
      recentSolved: recentSolved.slice(0, 10),
      heatmapData,
      patternHeatmap,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
};

/**
 * @name getHeatmapController
 * @description Get solves-per-date heatmap data for the user or a whole group
 * @access Private
 */
export const getHeatmap = async (req, res) => {
  try {
    const { groupId } = req.query;
    let userIdsToFetch = [req.userId];

    // If a group is specified, fetch all members of that group
    if (groupId && groupId !== 'me') {
      const members = await queryItems(`GROUP#${groupId}`, 'MEMBER#');
      if (members.length > 0) {
        // MEMBER items have `PK = GROUP#<id>`, `SK = MEMBER#<email>` — the email is in the SK
        userIdsToFetch = members.map(m => m.SK.replace('MEMBER#', ''));
      } else {
        userIdsToFetch = []; // Empty group
      }
    }

    const memberProgressItems = await Promise.all(
      userIdsToFetch.map((uid) => queryItems(`PROGRESS#${uid}`, 'PROB#'))
    );

    // Aggregate all solves per date (YYYY-MM-DD)
    const heatmapData = {};

    memberProgressItems.flat().forEach((p) => {
      if (p.solved === 1 && p.solvedAt) {
        // Extract just the date part (YYYY-MM-DD)
        const dateStr = p.solvedAt.split('T')[0];
        heatmapData[dateStr] = (heatmapData[dateStr] || 0) + 1;
      }
    });

    res.json(heatmapData);
  } catch (err) {
    console.error('Heatmap error:', err);
    res.status(500).json({ error: 'Failed to load heatmap data' });
  }
};

/**
 * @name getPatternHeatmapController
 * @description Get a user's pattern heatmap (strongest, weakest, neglected)
 * @access Private
 */
export const getPatternHeatmap = async (req, res) => {
  try {
    const uId = req.params.userId === 'me' ? req.userId : req.params.userId;

    const progressItems = await queryItems(`PROGRESS#${uId}`, 'PROB#');
    const progressMap = {};
    progressItems.forEach(p => {
      const lcNum = p.SK.replace('PROB#', '');
      const status = p.status || (p.solved === 1 ? 'solved' : 'unsolved');
      progressMap[lcNum] = { solved: p.solved, status };
    });

    const trackedProblems = await batchGetItems(
      Object.keys(progressMap).map((lcNum) => ({
        PK: `PROBLEM#${lcNum}`,
        SK: 'DETAIL',
      }))
    );

    const { patternHeatmap } = buildPatternInsights(trackedProblems, progressMap);
    res.json(patternHeatmap);
  } catch (err) {
    console.error('Pattern Heatmap error:', err);
    res.status(500).json({ error: 'Failed to load pattern heatmap' });
  }
};

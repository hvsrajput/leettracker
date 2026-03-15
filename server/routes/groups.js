const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { auth } = require('../middleware/auth');
const { putItem, getItem, queryItems, deleteItem, batchGetItems } = require('../db/dynamodb');
const { getProblemByNumber } = require('../utils/problemsDataset');

const router = express.Router();

function serializeGroupProblem(problem) {
  if (!problem) {
    return null;
  }

  const datasetEntry = getProblemByNumber(problem.leetcodeNumber);
  return {
    id: problem.leetcodeNumber,
    leetcode_number: problem.leetcodeNumber,
    title: problem.title,
    difficulty: problem.difficulty,
    url: problem.url,
    pattern_name: problem.patternName,
    topics: datasetEntry ? (datasetEntry.topics || []) : [],
    companies: datasetEntry ? (datasetEntry.companies || []) : [],
  };
}

module.exports = function () {
  // List user's groups
  router.get('/', auth, async (req, res) => {
    try {
      // Get all groups the user belongs to
      const userGroups = await queryItems(`USERGROUP#${req.userId}`, 'GROUP#');
      const progressItems = await queryItems(`PROGRESS#${req.userId}`, 'PROB#');
      const progressMap = {};

      progressItems.forEach((progress) => {
        const lcNum = progress.SK.replace('PROB#', '');
        progressMap[lcNum] = progress.status || (progress.solved === 1 ? 'solved' : 'unsolved');
      });

      const groups = (await Promise.all(userGroups.map(async (ug) => {
        const groupId = ug.SK.replace('GROUP#', '');
        const [detail, members, problems] = await Promise.all([
          getItem(`GROUP#${groupId}`, 'DETAIL'),
          queryItems(`GROUP#${groupId}`, 'MEMBER#'),
          queryItems(`GROUP#${groupId}`, 'PROBLEM#'),
        ]);

        if (!detail) return null;
        let solved_count = 0;
        let attempted_count = 0;

        for (const problem of problems) {
          const lcNum = problem.SK.replace('PROBLEM#', '');
          const status = progressMap[lcNum] || 'unsolved';

          if (status === 'solved') {
            solved_count += 1;
          } else if (status === 'attempted') {
            attempted_count += 1;
          }
        }

        return {
          id: groupId,
          name: detail.name,
          created_by: detail.createdBy,
          creator_name: detail.createdByUsername,
          created_at: detail.createdAt,
          member_count: members.length,
          problem_count: problems.length,
          solved_count,
          attempted_count,
          unsolved_count: Math.max(problems.length - solved_count - attempted_count, 0),
        };
      }))).filter(Boolean);

      // Sort by created_at descending
      groups.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      res.json(groups);
    } catch (err) {
      console.error('List groups error:', err);
      res.status(500).json({ error: 'Failed to list groups' });
    }
  });

  // Create group
  router.post('/', auth, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Group name is required' });
      }

      const groupId = uuidv4().slice(0, 8); // Short ID
      const trimmedName = name.trim();
      const now = new Date().toISOString();

      // Create group detail
      await putItem({
        PK: `GROUP#${groupId}`,
        SK: 'DETAIL',
        name: trimmedName,
        createdBy: req.userId,
        createdByUsername: req.username,
        createdAt: now,
      });

      // Add creator as member
      await putItem({
        PK: `GROUP#${groupId}`,
        SK: `MEMBER#${req.userId}`,
        username: req.username,
        joinedAt: now,
      });

      // Add user→group index
      await putItem({
        PK: `USERGROUP#${req.userId}`,
        SK: `GROUP#${groupId}`,
        groupName: trimmedName,
      });

      res.json({
        id: groupId,
        name: trimmedName,
        member_count: 1,
        problem_count: 0,
        solved_count: 0,
        attempted_count: 0,
        unsolved_count: 0,
      });
    } catch (err) {
      console.error('Create group error:', err);
      res.status(500).json({ error: 'Failed to create group' });
    }
  });

  // Get group detail with problems and member statuses
  router.get('/:id', auth, async (req, res) => {
    try {
      const groupId = req.params.id;

      // Check membership
      const membership = await getItem(`GROUP#${groupId}`, `MEMBER#${req.userId}`);
      if (!membership) {
        return res.status(403).json({ error: 'Not a member of this group' });
      }

      // Get group detail
      const detail = await getItem(`GROUP#${groupId}`, 'DETAIL');
      if (!detail) return res.status(404).json({ error: 'Group not found' });

      // Get members
      const memberItems = await queryItems(`GROUP#${groupId}`, 'MEMBER#');
      const members = memberItems.map(m => ({
        id: m.SK.replace('MEMBER#', ''),
        username: m.username,
      }));

      // Get group problems
      const groupProblemItems = await queryItems(`GROUP#${groupId}`, 'PROBLEM#');
      const [problemDetails, memberProgressMaps] = await Promise.all([
        batchGetItems(
          groupProblemItems.map((gp) => ({
            PK: `PROBLEM#${gp.SK.replace('PROBLEM#', '')}`,
            SK: 'DETAIL',
          }))
        ),
        Promise.all(
          members.map(async (member) => {
            const progressItems = await queryItems(`PROGRESS#${member.id}`, 'PROB#');
            const progressMap = {};

            progressItems.forEach((progress) => {
              const lcNum = progress.SK.replace('PROB#', '');
              progressMap[lcNum] = {
                solved: progress.solved || 0,
                status: progress.status || (progress.solved === 1 ? 'solved' : 'unsolved'),
              };
            });

            return { memberId: member.id, progressMap };
          })
        ),
      ]);

      const progressByMemberId = memberProgressMaps.reduce((acc, entry) => {
        acc[entry.memberId] = entry.progressMap;
        return acc;
      }, {});

      const problems = problemDetails
        .filter(Boolean)
        .map((problem) => {
          const datasetEntry = getProblemByNumber(problem.leetcodeNumber);
          const lcNum = String(problem.leetcodeNumber);
          const memberStatuses = members.map((member) => {
            const progress = progressByMemberId[member.id]?.[lcNum];
            return {
              user_id: member.id,
              username: member.username,
              solved: progress ? progress.solved : 0,
              status: progress?.status || 'unsolved',
            };
          });

          return {
            id: problem.leetcodeNumber,
            leetcode_number: problem.leetcodeNumber,
            title: problem.title,
            difficulty: problem.difficulty,
            url: problem.url,
            pattern_name: problem.patternName,
            topics: datasetEntry ? (datasetEntry.topics || []) : [],
            companies: datasetEntry ? (datasetEntry.companies || []) : [],
            member_statuses: memberStatuses,
          };
        });

      // Sort problems by leetcode number
      problems.sort((a, b) => a.leetcode_number - b.leetcode_number);

      res.json({
        id: groupId,
        name: detail.name,
        created_by: detail.createdBy,
        creator_name: detail.createdByUsername,
        created_at: detail.createdAt,
        members,
        problems,
      });
    } catch (err) {
      console.error('Group detail error:', err);
      res.status(500).json({ error: 'Failed to load group details' });
    }
  });

  // Add member by username
  router.post('/:id/members', auth, async (req, res) => {
    try {
      const groupId = req.params.id;
      const { username } = req.body;

      if (!username) return res.status(400).json({ error: 'Username is required' });

      // Look up user by username
      const userLookup = await getItem(`USERNAME#${username}`, 'PROFILE');
      if (!userLookup) return res.status(404).json({ error: 'User not found' });

      const userId = userLookup.email; // userId is the email

      // Check if already a member
      const existing = await getItem(`GROUP#${groupId}`, `MEMBER#${userId}`);
      if (existing) return res.status(400).json({ error: 'User already a member' });

      // Get group name for the index
      const groupDetail = await getItem(`GROUP#${groupId}`, 'DETAIL');

      // Add member
      await putItem({
        PK: `GROUP#${groupId}`,
        SK: `MEMBER#${userId}`,
        username: userLookup.username,
        joinedAt: new Date().toISOString(),
      });

      // Add user→group index
      await putItem({
        PK: `USERGROUP#${userId}`,
        SK: `GROUP#${groupId}`,
        groupName: groupDetail ? groupDetail.name : '',
      });

      res.json({ message: 'Member added', user: { id: userId, username: userLookup.username } });
    } catch (err) {
      console.error('Add member error:', err);
      res.status(500).json({ error: 'Failed to add member' });
    }
  });

  // Add problem to group
  router.post('/:id/problems/bulk', auth, async (req, res) => {
    try {
      const groupId = req.params.id;
      const rawProblemIds = Array.isArray(req.body?.problem_ids) ? req.body.problem_ids : [];
      const problemIds = [...new Set(
        rawProblemIds
          .map((problemId) => parseInt(problemId, 10))
          .filter((problemId) => Number.isInteger(problemId) && problemId > 0)
      )];

      if (problemIds.length === 0) {
        return res.status(400).json({ error: 'problem_ids must be a non-empty array' });
      }

      const existingGroupProblems = await queryItems(`GROUP#${groupId}`, 'PROBLEM#');
      const existingIds = new Set(
        existingGroupProblems.map((item) => parseInt(item.SK.replace('PROBLEM#', ''), 10))
      );

      const problemDetails = await batchGetItems(
        problemIds.map((problemId) => ({
          PK: `PROBLEM#${problemId}`,
          SK: 'DETAIL',
        }))
      );
      const problemsById = new Map(
        problemDetails.map((problem) => [problem.leetcodeNumber, problem])
      );

      const added = [];
      const failed = [];
      let alreadyInGroupCount = 0;
      const addedAt = new Date().toISOString();

      for (const problemId of problemIds) {
        if (existingIds.has(problemId)) {
          alreadyInGroupCount += 1;
          continue;
        }

        const problem = problemsById.get(problemId);
        if (!problem) {
          failed.push({ problem_id: problemId, error: 'Problem not found' });
          continue;
        }

        await putItem({
          PK: `GROUP#${groupId}`,
          SK: `PROBLEM#${problemId}`,
          addedBy: req.userId,
          addedAt,
        });

        existingIds.add(problemId);
        added.push(serializeGroupProblem(problem));
      }

      res.json({
        added,
        addedCount: added.length,
        alreadyInGroupCount,
        failedCount: failed.length,
        failed,
      });
    } catch (err) {
      console.error('Bulk add group problems error:', err);
      res.status(500).json({ error: 'Failed to add problems to group' });
    }
  });

  router.post('/:id/problems', auth, async (req, res) => {
    try {
      const groupId = req.params.id;
      const { problem_id } = req.body;

      if (!problem_id) return res.status(400).json({ error: 'Problem ID is required' });

      const lcNum = parseInt(problem_id);

      // Check if problem already in group
      const existing = await getItem(`GROUP#${groupId}`, `PROBLEM#${lcNum}`);
      if (existing) return res.status(400).json({ error: 'Problem already in group' });

      // Add problem to group
      await putItem({
        PK: `GROUP#${groupId}`,
        SK: `PROBLEM#${lcNum}`,
        addedBy: req.userId,
        addedAt: new Date().toISOString(),
      });

      // Get problem details to return
      const problem = await getItem(`PROBLEM#${lcNum}`, 'DETAIL');
      res.json(serializeGroupProblem(problem) || { id: lcNum, leetcode_number: lcNum });
    } catch (err) {
      console.error('Add group problem error:', err);
      res.status(500).json({ error: 'Failed to add problem to group' });
    }
  });

  // Leave group
  router.delete('/:id/leave', auth, async (req, res) => {
    try {
      const groupId = req.params.id;

      // Remove member record
      await deleteItem(`GROUP#${groupId}`, `MEMBER#${req.userId}`);

      // Remove user→group index
      await deleteItem(`USERGROUP#${req.userId}`, `GROUP#${groupId}`);

      res.json({ message: 'Left group' });
    } catch (err) {
      console.error('Leave group error:', err);
      res.status(500).json({ error: 'Failed to leave group' });
    }
  });

  return router;
};

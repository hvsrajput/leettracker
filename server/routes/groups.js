const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { auth } = require('../middleware/auth');
const { putItem, getItem, queryItems, deleteItem } = require('../db/dynamodb');

const router = express.Router();
const problemsDataset = require('../data/problems.json');
const datasetMap = new Map();

problemsDataset.forEach((problem) => datasetMap.set(problem.number, problem));

module.exports = function () {
  // List user's groups
  router.get('/', auth, async (req, res) => {
    try {
      // Get all groups the user belongs to
      const userGroups = await queryItems(`USERGROUP#${req.userId}`, 'GROUP#');

      const groups = [];
      for (const ug of userGroups) {
        const groupId = ug.SK.replace('GROUP#', '');
        const detail = await getItem(`GROUP#${groupId}`, 'DETAIL');
        if (!detail) continue;

        // Count members and problems
        const members = await queryItems(`GROUP#${groupId}`, 'MEMBER#');
        const problems = await queryItems(`GROUP#${groupId}`, 'PROBLEM#');

        groups.push({
          id: groupId,
          name: detail.name,
          created_by: detail.createdBy,
          creator_name: detail.createdByUsername,
          created_at: detail.createdAt,
          member_count: members.length,
          problem_count: problems.length,
        });
      }

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

      res.json({ id: groupId, name: trimmedName, member_count: 1, problem_count: 0 });
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
      
      // Fetch full problem details and progress for all members
      const problems = [];
      for (const gp of groupProblemItems) {
        const lcNum = gp.SK.replace('PROBLEM#', '');
        const problem = await getItem(`PROBLEM#${lcNum}`, 'DETAIL');
        if (!problem) continue;
        const datasetEntry = datasetMap.get(problem.leetcodeNumber);

        // Get progress for each member
        const memberStatuses = [];
        for (const member of members) {
          const progress = await getItem(`PROGRESS#${member.id}`, `PROB#${lcNum}`);
          memberStatuses.push({
            user_id: member.id,
            username: member.username,
            solved: progress ? progress.solved : 0,
            status: progress?.status || (progress?.solved === 1 ? 'solved' : 'unsolved'),
          });
        }

        problems.push({
          id: problem.leetcodeNumber,
          leetcode_number: problem.leetcodeNumber,
          title: problem.title,
          difficulty: problem.difficulty,
          url: problem.url,
          pattern_name: problem.patternName,
          topics: datasetEntry ? (datasetEntry.topics || []) : [],
          companies: datasetEntry ? (datasetEntry.companies || []) : [],
          member_statuses: memberStatuses,
        });
      }

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
      if (problem) {
        const datasetEntry = datasetMap.get(problem.leetcodeNumber);
        res.json({
          id: problem.leetcodeNumber,
          leetcode_number: problem.leetcodeNumber,
          title: problem.title,
          difficulty: problem.difficulty,
          url: problem.url,
          pattern_name: problem.patternName,
          topics: datasetEntry ? (datasetEntry.topics || []) : [],
          companies: datasetEntry ? (datasetEntry.companies || []) : [],
        });
      } else {
        res.json({ id: lcNum, leetcode_number: lcNum });
      }
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

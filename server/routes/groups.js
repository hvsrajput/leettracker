const express = require('express');
const { auth } = require('../middleware/auth');

const router = express.Router();

module.exports = function(db) {
  // List user's groups
  router.get('/', auth, (req, res) => {
    const groups = db.prepare(`
      SELECT g.*, u.username as creator_name,
        (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) as member_count,
        (SELECT COUNT(*) FROM group_problems gp WHERE gp.group_id = g.id) as problem_count
      FROM groups_ g
      JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
      JOIN users u ON u.id = g.created_by
      ORDER BY g.created_at DESC
    `).all(req.userId);
    res.json(groups);
  });

  // Create group
  router.post('/', auth, (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const result = db.prepare('INSERT INTO groups_ (name, created_by) VALUES (?, ?)').run(name.trim(), req.userId);
    // Auto-join creator
    db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(result.lastInsertRowid, req.userId);
    
    res.json({ id: result.lastInsertRowid, name: name.trim(), member_count: 1, problem_count: 0 });
  });

  // Get group detail with problems and member statuses
  router.get('/:id', auth, (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      
      // Check membership
      const membership = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, req.userId);
      if (!membership) {
        return res.status(403).json({ error: 'Not a member of this group' });
      }

      const group = db.prepare(`
        SELECT g.*, u.username as creator_name 
        FROM groups_ g JOIN users u ON u.id = g.created_by 
        WHERE g.id = ?
      `).get(groupId);
      
      if (!group) return res.status(404).json({ error: 'Group not found' });

      // Get members
      const members = db.prepare(`
        SELECT u.id, u.username 
        FROM group_members gm JOIN users u ON u.id = gm.user_id 
        WHERE gm.group_id = ?
        ORDER BY gm.joined_at ASC
      `).all(groupId);

      // Get problems for this group
      const problems = db.prepare(`
        SELECT p.*, pat.name as pattern_name
        FROM group_problems gp
        JOIN problems p ON p.id = gp.problem_id
        LEFT JOIN patterns pat ON p.pattern_id = pat.id
        WHERE gp.group_id = ?
        ORDER BY p.leetcode_number ASC
      `).all(groupId);

      // Get progress for all members on all group problems
      const problemIds = problems.map(p => p.id);
      const memberIds = members.map(m => m.id);

      const progressMap = {};
      if (problemIds.length > 0 && memberIds.length > 0) {
        const placeholders = problemIds.map(() => '?').join(',');
        const memberPlaceholders = memberIds.map(() => '?').join(',');
        const progressRows = db.prepare(`
          SELECT user_id, problem_id, solved 
          FROM user_progress 
          WHERE problem_id IN (${placeholders}) AND user_id IN (${memberPlaceholders})
        `).all(...problemIds, ...memberIds);

        progressRows.forEach(row => {
          const key = `${row.user_id}_${row.problem_id}`;
          progressMap[key] = row.solved;
        });
      }

      // Attach member statuses to each problem
      const problemsWithStatus = problems.map(p => ({
        ...p,
        member_statuses: members.map(m => ({
          user_id: m.id,
          username: m.username,
          solved: progressMap[`${m.id}_${p.id}`] || 0
        }))
      }));

      res.json({ ...group, members, problems: problemsWithStatus });
    } catch (err) {
      console.error('Group detail error:', err);
      res.status(500).json({ error: 'Failed to load group details' });
    }
  });

  // Add member by username
  router.post('/:id/members', auth, (req, res) => {
    const groupId = parseInt(req.params.id);
    const { username } = req.body;

    if (!username) return res.status(400).json({ error: 'Username is required' });

    const user = db.prepare('SELECT id, username FROM users WHERE username = ?').get(username);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const existing = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, user.id);
    if (existing) return res.status(400).json({ error: 'User already a member' });

    db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(groupId, user.id);
    res.json({ message: 'Member added', user: { id: user.id, username: user.username } });
  });

  // Add problem to group
  router.post('/:id/problems', auth, (req, res) => {
    const groupId = parseInt(req.params.id);
    const { problem_id } = req.body;

    if (!problem_id) return res.status(400).json({ error: 'Problem ID is required' });

    const existing = db.prepare('SELECT * FROM group_problems WHERE group_id = ? AND problem_id = ?').get(groupId, problem_id);
    if (existing) return res.status(400).json({ error: 'Problem already in group' });

    db.prepare('INSERT INTO group_problems (group_id, problem_id, added_by) VALUES (?, ?, ?)').run(groupId, problem_id, req.userId);
    
    const problem = db.prepare(`
      SELECT p.*, pat.name as pattern_name 
      FROM problems p LEFT JOIN patterns pat ON p.pattern_id = pat.id 
      WHERE p.id = ?
    `).get(problem_id);

    res.json(problem);
  });

  // Leave group
  router.delete('/:id/leave', auth, (req, res) => {
    const groupId = parseInt(req.params.id);
    db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, req.userId);
    res.json({ message: 'Left group' });
  });

  return router;
};

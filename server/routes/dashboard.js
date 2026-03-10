const express = require('express');
const { auth } = require('../middleware/auth');

const router = express.Router();

module.exports = function(db) {
  router.get('/', auth, (req, res) => {
    // Total solved
    const totalSolved = db.prepare(
      'SELECT COUNT(*) as count FROM user_progress WHERE user_id = ? AND solved = 1'
    ).get(req.userId).count;

    const totalProblems = db.prepare('SELECT COUNT(*) as count FROM problems').get().count;

    // Pattern-wise breakdown
    const patternStats = db.prepare(`
      SELECT pat.name,
        COUNT(DISTINCT p.id) as total,
        COUNT(DISTINCT CASE WHEN up.solved = 1 THEN p.id END) as solved
      FROM patterns pat
      LEFT JOIN problems p ON p.pattern_id = pat.id
      LEFT JOIN user_progress up ON up.problem_id = p.id AND up.user_id = ?
      WHERE p.id IS NOT NULL
      GROUP BY pat.id, pat.name
      ORDER BY pat.name ASC
    `).all(req.userId);

    // Difficulty breakdown
    const difficultyStats = db.prepare(`
      SELECT p.difficulty,
        COUNT(DISTINCT p.id) as total,
        COUNT(DISTINCT CASE WHEN up.solved = 1 THEN p.id END) as solved
      FROM problems p
      LEFT JOIN user_progress up ON up.problem_id = p.id AND up.user_id = ?
      GROUP BY p.difficulty
    `).all(req.userId);

    // Group progress
    const groupStats = db.prepare(`
      SELECT g.id, g.name,
        (SELECT COUNT(*) FROM group_problems gp WHERE gp.group_id = g.id) as total_problems,
        (SELECT COUNT(*) FROM group_problems gp 
         JOIN user_progress up ON up.problem_id = gp.problem_id AND up.user_id = ? AND up.solved = 1
         WHERE gp.group_id = g.id) as solved_problems,
        (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) as member_count
      FROM groups_ g
      JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
      ORDER BY g.created_at DESC
    `).all(req.userId, req.userId);

    // Recent activity
    const recentSolved = db.prepare(`
      SELECT p.leetcode_number, p.title, p.difficulty, up.solved_at
      FROM user_progress up
      JOIN problems p ON p.id = up.problem_id
      WHERE up.user_id = ? AND up.solved = 1
      ORDER BY up.solved_at DESC
      LIMIT 10
    `).all(req.userId);

    res.json({
      totalSolved,
      totalProblems,
      patternStats,
      difficultyStats,
      groupStats,
      recentSolved
    });
  });

  return router;
};

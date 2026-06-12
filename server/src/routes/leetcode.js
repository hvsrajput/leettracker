import express from 'express';
import { auth } from '../middleware/auth.js';
import { importFromLeetCode, syncFromLeetCode } from '../controllers/leetcodeController.js';

const router = express.Router();

/**
 * @route POST /api/leetcode/import
 * @description Import solved/attempted problem maps pasted by the user
 * @access Private
 */
router.post('/import', auth, importFromLeetCode);

/**
 * @route POST /api/leetcode/sync
 * @description Sync recent activity from the user's public LeetCode profile
 * @access Private
 */
router.post('/sync', auth, syncFromLeetCode);

export default router;

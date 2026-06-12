import express from 'express';
import { auth } from '../middleware/auth.js';
import { register, login, logout, getMe, updateLeetcodeUsername } from '../controllers/authController.js';

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @description Register a user
 * @access Public
 */
router.post('/register', register);

/**
 * @route POST /api/auth/login
 * @description Log in a user and issue a JWT
 * @access Public
 */
router.post('/login', login);

/**
 * @route POST /api/auth/logout
 * @description Clear the session cookie
 * @access Public
 */
router.post('/logout', logout);

/**
 * @route GET /api/auth/me
 * @description Get the current user's profile
 * @access Private
 */
router.get('/me', auth, getMe);

/**
 * @route PUT /api/auth/me/leetcode-username
 * @description Set or clear the user's linked LeetCode username
 * @access Private
 */
router.put('/me/leetcode-username', auth, updateLeetcodeUsername);

export default router;

import express from 'express';
import { auth } from '../middleware/auth.js';
import { getPatterns, addPattern } from '../controllers/patternsController.js';

const router = express.Router();

/**
 * @route GET /api/patterns
 * @description Get all patterns
 * @access Private
 */
router.get('/', auth, getPatterns);

/**
 * @route POST /api/patterns
 * @description Add a custom pattern
 * @access Private
 */
router.post('/', auth, addPattern);

export default router;

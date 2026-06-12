import express from 'express';
import { auth } from '../middleware/auth.js';
import { getDashboard, getHeatmap, getPatternHeatmap } from '../controllers/dashboardController.js';

const router = express.Router();

/**
 * @route GET /api/dashboard
 * @description Get the user's dashboard summary
 * @access Private
 */
router.get('/', auth, getDashboard);

/**
 * @route GET /api/dashboard/heatmap
 * @description Get solves-per-date heatmap data (optionally for a group)
 * @access Private
 */
router.get('/heatmap', auth, getHeatmap);

/**
 * @route GET /api/dashboard/pattern-heatmap/:userId
 * @description Get a user's pattern heatmap (strongest, weakest, neglected)
 * @access Private
 */
router.get('/pattern-heatmap/:userId', auth, getPatternHeatmap);

export default router;

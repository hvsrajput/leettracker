import express from 'express';
import { auth } from '../middleware/auth.js';
import {
  searchProblems,
  lookupProblem,
  getProblems,
  addProblem,
  toggleProblemStatus,
  updateProblemStatus,
  deleteProblem,
} from '../controllers/problemsController.js';

const router = express.Router();

/**
 * @route GET /api/problems/search
 * @description Search problems from the dataset by title or number (autocomplete)
 * @access Private
 */
router.get('/search', auth, searchProblems);

/**
 * @route GET /api/problems/lookup/:number
 * @description Lookup problem metadata from the dataset
 * @access Private
 */
router.get('/lookup/:number', auth, lookupProblem);

/**
 * @route GET /api/problems
 * @description Get the user's tracked problems with filters
 * @access Private
 */
router.get('/', auth, getProblems);

/**
 * @route POST /api/problems
 * @description Add a problem by LeetCode number
 * @access Private
 */
router.post('/', auth, addProblem);

/**
 * @route POST /api/problems/:id/toggle
 * @description Cycle a problem's status (unsolved -> attempted -> solved -> unsolved)
 * @access Private
 */
router.post('/:id/toggle', auth, toggleProblemStatus);

/**
 * @route POST /api/problems/:id/status
 * @description Set a problem's status explicitly
 * @access Private
 */
router.post('/:id/status', auth, updateProblemStatus);

/**
 * @route DELETE /api/problems/:id
 * @description Untrack a problem for the user
 * @access Private
 */
router.delete('/:id', auth, deleteProblem);

export default router;

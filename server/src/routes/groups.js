import express from 'express';
import { auth } from '../middleware/auth.js';
import {
  listGroups,
  createGroup,
  getGroupDetail,
  addMember,
  bulkAddProblemsToGroup,
  addProblemToGroup,
  deleteGroup,
  leaveGroup,
} from '../controllers/groupsController.js';

const router = express.Router();

/**
 * @route GET /api/groups
 * @description List the user's groups
 * @access Private
 */
router.get('/', auth, listGroups);

/**
 * @route POST /api/groups
 * @description Create a group
 * @access Private
 */
router.post('/', auth, createGroup);

/**
 * @route GET /api/groups/:id
 * @description Get group detail with problems and member statuses
 * @access Private
 */
router.get('/:id', auth, getGroupDetail);

/**
 * @route POST /api/groups/:id/members
 * @description Add a member to a group by username
 * @access Private
 */
router.post('/:id/members', auth, addMember);

/**
 * @route POST /api/groups/:id/problems/bulk
 * @description Add multiple problems to a group
 * @access Private
 */
router.post('/:id/problems/bulk', auth, bulkAddProblemsToGroup);

/**
 * @route POST /api/groups/:id/problems
 * @description Add a single problem to a group
 * @access Private
 */
router.post('/:id/problems', auth, addProblemToGroup);

/**
 * @route DELETE /api/groups/:id
 * @description Delete a group (creator only)
 * @access Private
 */
router.delete('/:id', auth, deleteGroup);

/**
 * @route DELETE /api/groups/:id/leave
 * @description Leave a group
 * @access Private
 */
router.delete('/:id/leave', auth, leaveGroup);

export default router;

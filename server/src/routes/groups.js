import express from 'express';
import { auth } from '../middleware/auth.js';
import {
  listGroups,
  createGroup,
  getGroupDetail,
  addMember,
  getInvite,
  rotateInvite,
  previewInvite,
  joinGroup,
  updateGroup,
  listStarterListsController,
  importStarterList,
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
 * @route GET /api/groups/starter-lists
 * @description List curated starter lists (Blind 75, NeetCode 150)
 * @access Private
 * @note Registered before '/:id' so the static segment is not captured as an id.
 */
router.get('/starter-lists', auth, listStarterListsController);

/**
 * @route GET /api/groups/:id
 * @description Get group detail with problems and member statuses
 * @access Private
 */
router.get('/:id', auth, getGroupDetail);

/**
 * @route GET /api/groups/:id/invite
 * @description Get the group's shareable invite token (members only)
 * @access Private
 */
router.get('/:id/invite', auth, getInvite);

/**
 * @route POST /api/groups/:id/invite/rotate
 * @description Rotate the invite token, invalidating old links (creator only)
 * @access Private
 */
router.post('/:id/invite/rotate', auth, rotateInvite);

/**
 * @route GET /api/groups/:id/invite/preview
 * @description Minimal group info for the join screen, gated on a valid token
 * @access Private
 */
router.get('/:id/invite/preview', auth, previewInvite);

/**
 * @route POST /api/groups/:id/join
 * @description Join a group via invite token (idempotent)
 * @access Private
 */
router.post('/:id/join', auth, joinGroup);

/**
 * @route POST /api/groups/:id/starter-lists/:listId/import
 * @description Import a curated starter list into the group (members only)
 * @access Private
 */
router.post('/:id/starter-lists/:listId/import', auth, importStarterList);

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
 * @route PUT /api/groups/:id
 * @description Rename a group (creator only)
 * @access Private
 */
router.put('/:id', auth, updateGroup);

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

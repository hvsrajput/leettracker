import api from '@/shared/lib/api';

export const listGroups = () => api.getCached('/groups', {}, 15000);

export const getGroup = (groupId) => api.getCached(`/groups/${groupId}`, {}, 10000);

export const createGroup = (name) => api.post('/groups', { name });

export const updateGroupName = (groupId, name) =>
  api.put(`/groups/${groupId}`, { name });

export const deleteGroup = (groupId, name) =>
  api.delete(`/groups/${groupId}`, { data: { name } });

export const addGroupMember = (groupId, username) =>
  api.post(`/groups/${groupId}/members`, { username });

export const addProblemToGroup = (groupId, problemId) =>
  api.post(`/groups/${groupId}/problems`, { problem_id: problemId });

export const bulkAddProblemsToGroup = (groupId, problemIds) =>
  api.post(`/groups/${groupId}/problems/bulk`, { problem_ids: problemIds });

// --- invite links ---

export const getGroupInvite = (groupId) => api.get(`/groups/${groupId}/invite`);

export const rotateGroupInvite = (groupId) => api.post(`/groups/${groupId}/invite/rotate`);

export const previewGroupInvite = (groupId, token) =>
  api.get(`/groups/${groupId}/invite/preview`, { params: { token } });

export const joinGroup = (groupId, token) =>
  api.post(`/groups/${groupId}/join`, { token });

// --- curated starter lists ---

export const listStarterLists = () => api.getCached('/groups/starter-lists', {}, 300000);

export const importStarterList = (groupId, listId) =>
  api.post(`/groups/${groupId}/starter-lists/${listId}/import`);

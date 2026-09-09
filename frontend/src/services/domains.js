import api from './api';
import { createResourceApi, createNestedResourceApi } from './resourceApiFactory';

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }).then((r) => r.data),
  logout: () => api.post('/auth/logout').then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  changePassword: (payload) => api.post('/auth/change-password', payload).then((r) => r.data),
};

export const profileApi = {
  getMe: () => api.get('/profile/me').then((r) => r.data),
  updateMe: (payload) => api.patch('/profile/me', payload).then((r) => r.data),
  getAccount: () => api.get('/profile/account').then((r) => r.data),
  getPrivacy: () => api.get('/profile/privacy').then((r) => r.data),
  updatePrivacy: (payload) => api.put('/profile/privacy', payload).then((r) => r.data),
  getSessions: () => api.get('/profile/sessions').then((r) => r.data),
  revokeSession: (id) => api.delete(`/profile/sessions/${id}`).then((r) => r.data),
  revokeOtherSessions: () => api.delete('/profile/sessions').then((r) => r.data),
  getActivity: (params) => api.get('/profile/activity', { params }).then((r) => r.data),
};

export const applicationsApi = {
  ...createResourceApi('/applications'),
  eligibleOwners: () => api.get('/applications/eligible-owners').then((r) => r.data),
};
export const ideasApi = {
  ...createResourceApi('/ideas'),
  statusHistory: (id) => api.get(`/ideas/${id}/status-history`).then((r) => r.data),
  analytics: () => api.get('/ideas/analytics').then((r) => r.data),
  eligibleOwners: () => api.get('/ideas/eligible-owners').then((r) => r.data),
  submitReview: (id, payload) => api.post(`/ideas/${id}/reviews`, payload).then((r) => r.data),
  panelCandidates: (id, kind) => api.get(`/ideas/${id}/panel-candidates`, { params: { kind } }).then((r) => r.data),
  addParticipants: (id, payload) => api.post(`/ideas/${id}/panel`, payload).then((r) => r.data),
  removeParticipant: (id, userId) => api.delete(`/ideas/${id}/panel/${userId}`).then((r) => r.data),
};
// "Modify Current Application" — split out of ideasApi into its own module/table/resource, see
// 20260130000035-split-feature-requests-from-ideas.js. No eligibleOwners — a feature request
// never registers a new Application, so that concept doesn't apply here.
export const featureRequestsApi = {
  ...createResourceApi('/feature-requests'),
  statusHistory: (id) => api.get(`/feature-requests/${id}/status-history`).then((r) => r.data),
  analytics: () => api.get('/feature-requests/analytics').then((r) => r.data),
  submitReview: (id, payload) => api.post(`/feature-requests/${id}/reviews`, payload).then((r) => r.data),
  panelCandidates: (id, kind) => api.get(`/feature-requests/${id}/panel-candidates`, { params: { kind } }).then((r) => r.data),
  addParticipants: (id, payload) => api.post(`/feature-requests/${id}/panel`, payload).then((r) => r.data),
  removeParticipant: (id, userId) => api.delete(`/feature-requests/${id}/panel/${userId}`).then((r) => r.data),
};

// Not built on createNestedResourceApi — issues has no generic PUT/DELETE surface (see
// backend/src/modules/issues/issues.routes.js), just report + named triage/assign/resolve/
// reopen/convert actions.
export const issuesApi = {
  list: (appId, params) => api.get(`/applications/${appId}/issues`, { params }).then((r) => r.data),
  getById: (appId, id) => api.get(`/applications/${appId}/issues/${id}`).then((r) => r.data),
  create: (appId, payload) => api.post(`/applications/${appId}/issues`, payload).then((r) => r.data),
  triage: (appId, id, payload) => api.patch(`/applications/${appId}/issues/${id}/triage`, payload).then((r) => r.data),
  assign: (appId, id, payload) => api.patch(`/applications/${appId}/issues/${id}/assign`, payload).then((r) => r.data),
  resolve: (appId, id, payload) => api.patch(`/applications/${appId}/issues/${id}/resolve`, payload).then((r) => r.data),
  reopen: (appId, id, payload) => api.patch(`/applications/${appId}/issues/${id}/reopen`, payload).then((r) => r.data),
  convert: (appId, id) => api.post(`/applications/${appId}/issues/${id}/convert`).then((r) => r.data),
  assigneeCandidates: (appId) => api.get(`/applications/${appId}/issues/assignee-candidates`).then((r) => r.data),
};
export const changeRequestsApi = {
  ...createNestedResourceApi((appId) => `/applications/${appId}/change-requests`),
  updateStage: (appId, id, stage, payload) => api
    .patch(`/applications/${appId}/change-requests/${id}/stages/${stage}`, payload).then((r) => r.data),
  assigneeCandidates: (appId, id) => api
    .get(`/applications/${appId}/change-requests/${id}/assignee-candidates`).then((r) => r.data),
  bulkAssignStages: (appId, id, payload) => api
    .patch(`/applications/${appId}/change-requests/${id}/assignments`, payload).then((r) => r.data),
  // Top-level, not nested under an application — backs the Dashboard's "My Development"/
  // "My Testing"/"My Deployment" tiles and the list page they link to.
  myAssignedStages: (stage) => api
    .get('/change-requests/my-stages', { params: { stage } }).then((r) => r.data),
};

// Top-level, not nested under an application — a track precedes one. No create/remove (a track is
// only ever created by an idea being approved, never deleted, only cancelled — see
// backend/src/modules/applicationTracking/applicationTracking.routes.js). update() is PATCH, not
// PUT — createResourceApi's generic shape doesn't fit here either.
export const applicationTrackingApi = {
  list: (params) => api.get('/application-tracking', { params }).then((r) => r.data),
  getById: (id) => api.get(`/application-tracking/${id}`).then((r) => r.data),
  update: (id, payload) => api.patch(`/application-tracking/${id}`, payload).then((r) => r.data),
  updateStage: (id, stage, payload) => api.patch(`/application-tracking/${id}/stages/${stage}`, payload).then((r) => r.data),
  goLive: (id) => api.patch(`/application-tracking/${id}/go-live`).then((r) => r.data),
  assignStages: (id, payload) => api.post(`/application-tracking/${id}/stages/assign`, payload).then((r) => r.data),
  assigneeCandidates: (id) => api.get(`/application-tracking/${id}/assignee-candidates`).then((r) => r.data),
  hold: (id, payload) => api.patch(`/application-tracking/${id}/hold`, payload).then((r) => r.data),
  resume: (id) => api.patch(`/application-tracking/${id}/resume`).then((r) => r.data),
  cancel: (id, payload) => api.patch(`/application-tracking/${id}/cancel`, payload).then((r) => r.data),
};

export const usersApi = {
  ...createResourceApi('/users'),
  updateProfile: (payload) => api.patch('/users/me/profile', payload).then((r) => r.data),
};
export const rolesApi = {
  ...createResourceApi('/roles'),
  setPermissions: (id, permissions) => api.put(`/roles/${id}/permissions`, { permissions }).then((r) => r.data),
};
export const departmentsApi = createResourceApi('/departments');
export const auditLogsApi = createResourceApi('/audit-logs');

export const commentsApi = {
  list: (entityType, entityId) => api.get('/comments', { params: { entityType, entityId } }).then((r) => r.data),
  create: (payload) => api.post('/comments', payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/comments/${id}`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/comments/${id}`).then((r) => r.data),
};

export const votesApi = {
  toggle: (payload) => api.post('/votes/toggle', payload).then((r) => r.data),
  summary: (entityType, entityId) => api.get('/votes/summary', { params: { entityType, entityId } }).then((r) => r.data),
};

export const tagsApi = {
  list: (search) => api.get('/tags', { params: { search } }).then((r) => r.data),
  forEntity: (entityType, entityId) => api.get('/tags/for-entity', { params: { entityType, entityId } }).then((r) => r.data),
  setForEntity: (entityType, entityId, tags) => api.put('/tags/for-entity', { entityType, entityId, tags }).then((r) => r.data),
};

export const attachmentsApi = {
  list: (entityType, entityId) => api.get('/attachments', { params: { entityType, entityId } }).then((r) => r.data),
  upload: (entityType, entityId, file) => {
    const form = new FormData();
    form.append('file', file);
    form.append('entityType', entityType);
    form.append('entityId', entityId);
    return api.post('/attachments', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
  },
  remove: (id) => api.delete(`/attachments/${id}`).then((r) => r.data),
};

export const dashboardApi = { summary: () => api.get('/dashboard').then((r) => r.data) };
export const searchApi = { search: (q) => api.get('/search', { params: { q } }).then((r) => r.data) };
export const notificationsApi = {
  list: (params) => api.get('/notifications', { params }).then((r) => r.data),
  unreadCount: () => api.get('/notifications/unread-count').then((r) => r.data),
  markRead: (id) => api.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.patch('/notifications/read-all').then((r) => r.data),
};

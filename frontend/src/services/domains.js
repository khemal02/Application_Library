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

export const applicationsApi = createResourceApi('/applications');
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
export const suggestionsApi = {
  ...createResourceApi('/suggestions'),
  transition: (id, payload) => api.patch(`/suggestions/${id}/status`, payload).then((r) => r.data),
  statusHistory: (id) => api.get(`/suggestions/${id}/status-history`).then((r) => r.data),
  eligibleReviewers: (id) => api.get(`/suggestions/${id}/eligible-reviewers`).then((r) => r.data),
  submitReview: (id, payload) => api.post(`/suggestions/${id}/reviews`, payload).then((r) => r.data),
  submitDecision: (id, payload) => api.post(`/suggestions/${id}/decision`, payload).then((r) => r.data),
};

export const techStackApi = createNestedResourceApi((appId) => `/applications/${appId}/tech-stack`);
export const featuresApi = createNestedResourceApi((appId) => `/applications/${appId}/features`);
export const aiPromptsApi = createNestedResourceApi((appId) => `/applications/${appId}/ai-prompts`);
export const apiDocsApi = createNestedResourceApi((appId) => `/applications/${appId}/api-docs`);
export const dbDocsApi = createNestedResourceApi((appId) => `/applications/${appId}/db-docs`);
export const releasesApi = createNestedResourceApi((appId) => `/applications/${appId}/releases`);
export const bugsApi = createNestedResourceApi((appId) => `/applications/${appId}/bugs`);
export const knownIssuesApi = createNestedResourceApi((appId) => `/applications/${appId}/known-issues`);
export const roadmapApi = createNestedResourceApi((appId) => `/applications/${appId}/roadmap`);
export const timelineApi = createNestedResourceApi((appId) => `/applications/${appId}/timeline`);
export const changeRequestsApi = createNestedResourceApi((appId) => `/applications/${appId}/change-requests`);

export const architectureDocsApi = {
  list: (appId, params) => api.get(`/applications/${appId}/architecture-docs`, { params }).then((r) => r.data),
  upsert: (appId, payload) => api.put(`/applications/${appId}/architecture-docs`, { ...payload, applicationId: appId }).then((r) => r.data),
  remove: (appId, id) => api.delete(`/applications/${appId}/architecture-docs/${id}`).then((r) => r.data),
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

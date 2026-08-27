import api from './api';

/** Top-level resource, e.g. createResourceApi('/applications'). */
export function createResourceApi(basePath) {
  return {
    list: (params) => api.get(basePath, { params }).then((r) => r.data),
    getById: (id) => api.get(`${basePath}/${id}`).then((r) => r.data),
    create: (payload) => api.post(basePath, payload).then((r) => r.data),
    update: (id, payload) => api.put(`${basePath}/${id}`, payload).then((r) => r.data),
    remove: (id) => api.delete(`${basePath}/${id}`).then((r) => r.data),
  };
}

/** Resource nested under a parent id, e.g. /applications/:applicationId/tech-stack. */
export function createNestedResourceApi(buildBasePath) {
  return {
    list: (parentId, params) => api.get(buildBasePath(parentId), { params }).then((r) => r.data),
    getById: (parentId, id) => api.get(`${buildBasePath(parentId)}/${id}`).then((r) => r.data),
    create: (parentId, payload) => api.post(buildBasePath(parentId), payload).then((r) => r.data),
    update: (parentId, id, payload) => api.put(`${buildBasePath(parentId)}/${id}`, payload).then((r) => r.data),
    remove: (parentId, id) => api.delete(`${buildBasePath(parentId)}/${id}`).then((r) => r.data),
  };
}

/**
 * Core RBAC predicate: does this permission set grant `action` on `resource`? A `*` resource or a
 * `manage` action both act as wildcards. Single source of truth for this check — rbac.middleware.js
 * and any other caller (e.g. a service-level stage-owner guard) share it rather than each keeping
 * their own copy that could silently drift.
 */
function hasPermission(permissions, resource, action) {
  return (permissions || []).some((p) => {
    const resourceMatches = p.resource === resource || p.resource === '*';
    const actionMatches = p.action === action || p.action === 'manage';
    return resourceMatches && actionMatches;
  });
}

/**
 * Strictly the global wildcard grant — resource === '*' AND action === 'manage'. Only Admin holds
 * this. Deliberately narrower than `hasPermission(permissions, X, 'manage')`, which would also
 * match a resource-scoped 'manage' row (e.g. CEO/Manager's ('ideas','manage')) — callers that need
 * "is this the one true super-admin bypass" (not "does this role manage resource X") want this one.
 */
function isSuperAdmin(permissions) {
  return (permissions || []).some((p) => p.resource === '*' && p.action === 'manage');
}

module.exports = { hasPermission, isSuperAdmin };

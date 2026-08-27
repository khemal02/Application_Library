const ApiError = require('../utils/ApiError');
const { hasPermission } = require('../utils/permissions');

/**
 * Data-driven RBAC: permissions come from role_permissions rows loaded onto req.user by the
 * auth middleware, not a hard-coded switch on role name. `manage` on a resource (or resource
 * `*`) implies every action on it — that's how super_admin/admin get unrestricted access.
 */
function authorize(resource, action) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());

    if (!hasPermission(req.user.permissions, resource, action)) {
      return next(ApiError.forbidden(`You do not have permission to ${action} ${resource}`));
    }
    next();
  };
}

module.exports = { authorize };

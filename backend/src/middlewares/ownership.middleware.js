const ApiError = require('../utils/ApiError');

function isPrivileged(user) {
  return user.permissions.some((p) => p.resource === '*' && p.action === 'manage');
}

/**
 * RBAC in this app is resource-level only ("can this role update tech_stack at all?") — it says
 * nothing about *whose* application. Without this check, any role with a `create`/`update` grant
 * on an application sub-resource could edit any department's application, not just their own.
 * Applied to the application record itself and to every documentation sub-resource nested under
 * it. Super admin / admin (the `*`:`manage` wildcard) bypass, since they're expected to manage
 * everything.
 */
function requireApplicationAccess(paramName = 'applicationId') {
  return async (req, res, next) => {
    try {
      if (isPrivileged(req.user)) return next();

      const { Application } = require('../models');
      const applicationId = req.params[paramName];
      const application = await Application.findByPk(applicationId, { attributes: ['id', 'ownerId', 'departmentId'] });
      if (!application) return next(ApiError.notFound('Application not found'));

      const isOwner = application.ownerId === req.user.id;
      const isSameDepartment = !!application.departmentId && application.departmentId === req.user.departmentId;
      if (!isOwner && !isSameDepartment) {
        return next(ApiError.forbidden('You do not have access to manage this application'));
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

/**
 * For records that belong to an individual (ideas, suggestions): only the original submitter or
 * a privileged user may edit/delete it. Review/status-transition actions are deliberately NOT
 * gated by this — those are cross-department by design and already governed by the `review` RBAC
 * permission on their own routes.
 */
function requireRecordOwnership(getModel, ownerField, paramName = 'id') {
  return async (req, res, next) => {
    try {
      if (isPrivileged(req.user)) return next();

      const Model = getModel();
      const record = await Model.findByPk(req.params[paramName], { attributes: ['id', ownerField] });
      if (!record) return next(ApiError.notFound('Record not found'));
      if (record[ownerField] !== req.user.id) {
        return next(ApiError.forbidden('You can only modify your own submission'));
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { requireApplicationAccess, requireRecordOwnership, isPrivileged };

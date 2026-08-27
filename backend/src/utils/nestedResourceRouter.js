const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');
const { requireApplicationAccess } = require('../middlewares/ownership.middleware');
const validate = require('../middlewares/validate.middleware');
const scopeToParent = require('./scopeToParent');

/**
 * Standard list/getById/create/update/remove router for a resource nested under
 * /applications/:applicationId/<resource>. Collapses the ~10 near-identical route files this
 * project had (tech stack, features, AI prompts, API docs, DB docs, releases, bugs, known
 * issues, roadmap, timeline) into one factory, and guarantees every one of them gets the same
 * RBAC + application-ownership checks instead of relying on each file remembering to wire both.
 */
function createNestedCrudRouter({ resource, controller, validators }) {
  const router = express.Router({ mergeParams: true });
  router.use(authenticate, scopeToParent('applicationId'));

  router.get('/', authorize(resource, 'read'), controller.list);
  router.get('/:id', authorize(resource, 'read'), controller.getById);
  router.post(
    '/', authorize(resource, 'create'), requireApplicationAccess('applicationId'),
    validate(validators.create), controller.create,
  );
  router.put(
    '/:id', authorize(resource, 'update'), requireApplicationAccess('applicationId'),
    validate(validators.update), controller.update,
  );
  router.delete(
    '/:id', authorize(resource, 'delete'), requireApplicationAccess('applicationId'),
    controller.remove,
  );

  return router;
}

module.exports = { createNestedCrudRouter };

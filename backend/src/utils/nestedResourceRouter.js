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
 *
 * requireOwnership (default true) gates create/update/delete on the caller owning the
 * application or sharing its department, on top of the resource-level RBAC check — set it to
 * false for a resource that's deliberately open to anyone regardless of which application/
 * department they belong to (e.g. change_requests, where every role gets full CRUD everywhere).
 *
 * deleteOwnerCheck is an optional extra middleware (e.g. requireRecordOwnership(...)) inserted
 * only on the delete route, for a resource where anyone can create/read/update but only the
 * original submitter (or a true super-admin) may delete their own record — same shape as
 * ideas/suggestions' ownIdeaOnly, just opt-in per resource instead of hand-rolling the whole route.
 */
function createNestedCrudRouter({
  resource, controller, validators, requireOwnership = true, deleteOwnerCheck,
}) {
  const router = express.Router({ mergeParams: true });
  router.use(authenticate, scopeToParent('applicationId'));
  const ownershipGate = requireOwnership ? [requireApplicationAccess('applicationId')] : [];
  const deleteGate = deleteOwnerCheck ? [deleteOwnerCheck] : [];

  router.get('/', authorize(resource, 'read'), controller.list);
  router.get('/:id', authorize(resource, 'read'), controller.getById);
  router.post(
    '/', authorize(resource, 'create'), ...ownershipGate,
    validate(validators.create), controller.create,
  );
  router.put(
    '/:id', authorize(resource, 'update'), ...ownershipGate,
    validate(validators.update), controller.update,
  );
  router.delete(
    '/:id', authorize(resource, 'delete'), ...ownershipGate, ...deleteGate,
    controller.remove,
  );

  return router;
}

module.exports = { createNestedCrudRouter };

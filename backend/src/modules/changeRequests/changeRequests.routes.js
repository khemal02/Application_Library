const { createNestedCrudRouter } = require('../../utils/nestedResourceRouter');
const { requireRecordOwnership } = require('../../middlewares/ownership.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const validate = require('../../middlewares/validate.middleware');
const { ChangeRequest } = require('../../models');
const controller = require('./changeRequests.controller');
const {
  create, update, updateStageParams, updateStageBody,
} = require('./changeRequests.validator');

// Create/read/update are open to every role regardless of application ownership/department — see
// requireOwnership's doc comment on createNestedCrudRouter. Delete is narrower: only the person
// who raised a given change request (or a true super-admin) may delete it — same ownership shape
// as ideas/suggestions, just scoped to `requestedBy` instead of `submittedBy`.
const ownChangeRequestOnly = requireRecordOwnership(() => ChangeRequest, 'requestedBy');

const router = createNestedCrudRouter({
  resource: 'change_requests',
  controller,
  validators: { create, update },
  requireOwnership: false,
  deleteOwnerCheck: ownChangeRequestOnly,
});

// Stage transitions — a hand-written action, not part of the generic CRUD surface. Reuses the
// module's own `change_requests` RBAC resource (there's no separate stages permission row); the
// real authorization (application owner / this stage's assignee / super-admin) is enforced inside
// changeRequests.service.js#updateStage, the same "route-level check is coarse, the service is the
// real gate" shape used elsewhere in this project (e.g. ideas.service.js#submitReview).
router.patch(
  '/:id/stages/:stage',
  authorize('change_requests', 'update'),
  validate({ params: updateStageParams, body: updateStageBody }),
  controller.updateStage,
);

// Any active user is a valid assignee (see changeRequests.service.js#assigneeCandidates) — gated
// at 'read', not 'update', since this only powers a dropdown, not a mutation.
router.get(
  '/:id/assignee-candidates',
  authorize('change_requests', 'read'),
  controller.assigneeCandidates,
);

module.exports = router;

const { createNestedCrudRouter } = require('../../utils/nestedResourceRouter');
const { requireRecordOwnership } = require('../../middlewares/ownership.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const validate = require('../../middlewares/validate.middleware');
const { ChangeRequest } = require('../../models');
const controller = require('./changeRequests.controller');
const {
  create, update, updateStageParams, updateStageBody, bulkAssignParams, bulkAssignBody, implementParams,
  advanceStageParams, advanceStageBody, sendBackStageParams, sendBackStageBody,
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

// Completes the given stage and starts the next one in one call — the narrow, explicit exception
// to "stage status is forward-only one step at a time" described in
// changeRequests.service.js#advanceStage. Same coarse route-level gate as every write here; the
// real (assignee-or-super-admin-only, narrower than the plain PATCH's owner-inclusive gate) check
// lives in the service.
router.patch(
  '/:id/stages/:stage/advance',
  authorize('change_requests', 'update'),
  validate({ params: advanceStageParams, body: advanceStageBody }),
  controller.advanceStage,
);

// The only place a stage is ever allowed to move backward — see
// changeRequests.service.js#sendBackStage for the preconditions and why this doesn't loosen the
// plain PATCH's own forward-only rule.
router.patch(
  '/:id/stages/:stage/send-back',
  authorize('change_requests', 'update'),
  validate({ params: sendBackStageParams, body: sendBackStageBody }),
  controller.sendBackStage,
);

// Any active user is a valid assignee (see changeRequests.service.js#assigneeCandidates) — gated
// at 'read', not 'update', since this only powers a dropdown, not a mutation.
router.get(
  '/:id/assignee-candidates',
  authorize('change_requests', 'read'),
  controller.assigneeCandidates,
);

// Mirrors ideas.routes.js's / featureRequests.routes.js's own '/:id/status-history' — added so
// Stage 2's activity/timeline list (and a send-back's reason specifically) has something real to
// render; see changeRequests.service.js#statusHistory.
router.get(
  '/:id/status-history',
  authorize('change_requests', 'read'),
  controller.statusHistory,
);

// Bulk assign/reassign/clear any of the three stages in one call — route-level gate is the same
// coarse 'change_requests:update' every other write here uses; the REAL gate (owner or super-admin
// only, narrower than updateStage()'s own owner-or-assignee-or-super-admin) lives in
// changeRequests.service.js#bulkAssignStages.
router.patch(
  '/:id/assignments',
  authorize('change_requests', 'update'),
  validate({ params: bulkAssignParams, body: bulkAssignBody }),
  controller.bulkAssignStages,
);

// The deliberate, owner-only step that used to happen automatically the instant Deployment was
// marked complete — same split applicationTracking.routes.js's own '/:id/go-live' already makes.
// Route-level gate is the same coarse 'change_requests:update' every write here uses; the real
// owner-or-super-admin-only gate lives in changeRequests.service.js#implement.
router.patch(
  '/:id/implement',
  authorize('change_requests', 'update'),
  validate({ params: implementParams }),
  controller.implement,
);

module.exports = router;

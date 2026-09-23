const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const validate = require('../../middlewares/validate.middleware');
const controller = require('./applicationTracking.controller');
const {
  listQuery, idParam, update, stageParams, stageBody, assignBody, holdBody, cancelBody,
  advanceStageParams, advanceStageBody, sendBackStageParams, sendBackStageBody, reorderBody,
  queueReorderBody,
} = require('./applicationTracking.validator');

// Top-level, not nested under an application — a track precedes one (see myStages.routes.js for
// the same reasoning applied to /change-requests/my-stages). No POST / and no DELETE /:id (1c): a
// track is only ever created by an idea being approved (Stage 2a, not yet wired) and is never
// deleted, only cancelled. Route-level `authorize` is deliberately coarse (application_tracks:read
// / :update) — the real per-action gate (track owner / stage assignee / super-admin) is enforced
// inside applicationTracking.service.js, same "coarse route, real gate in the service" shape as
// changeRequests/ideas throughout this codebase.
const router = express.Router();
router.use(authenticate);

router.get('/', authorize('application_tracks', 'read'), validate({ query: listQuery }), controller.list);

// The combined "Idea Prioritization" queue (application_tracks + feature-request-sourced
// change_requests — see applicationTracking.service.js#getQueue/#reorderQueueItem). Registered
// before '/:id' so 'queue' is never swallowed as an :id.
router.get('/queue', authorize('application_tracks', 'read'), controller.getQueue);
router.patch(
  '/queue/reorder',
  authorize('ideas', 'moveToBuild'),
  validate({ body: queueReorderBody }),
  controller.reorderQueue,
);

router.get('/:id', authorize('application_tracks', 'read'), validate({ params: idParam }), controller.getById);
router.patch('/:id', authorize('application_tracks', 'update'), validate({ params: idParam, body: update }), controller.update);

router.patch(
  '/:id/stages/:stage',
  authorize('application_tracks', 'update'),
  validate({ params: stageParams, body: stageBody }),
  controller.updateStage,
);
router.post(
  '/:id/stages/assign',
  authorize('application_tracks', 'update'),
  validate({ params: idParam, body: assignBody }),
  controller.assignStages,
);
router.get(
  '/:id/assignee-candidates',
  authorize('application_tracks', 'read'),
  validate({ params: idParam }),
  controller.assigneeCandidates,
);

// Completes the given stage and starts the next one in one call — the narrow, explicit exception
// to "stage status is forward-only one step at a time" described in
// applicationTracking.service.js#advanceStage. Same coarse route-level gate as every write here;
// the real (assignee-or-super-admin-only) check lives in the service.
router.patch(
  '/:id/stages/:stage/advance',
  authorize('application_tracks', 'update'),
  validate({ params: advanceStageParams, body: advanceStageBody }),
  controller.advanceStage,
);

// The only place a stage is ever allowed to move backward — see
// applicationTracking.service.js#sendBackStage for the preconditions.
router.patch(
  '/:id/stages/:stage/send-back',
  authorize('application_tracks', 'update'),
  validate({ params: sendBackStageParams, body: sendBackStageBody }),
  controller.sendBackStage,
);

// Mirrors changeRequests.routes.js's own '/:id/status-history' — backs the activity/timeline list
// beneath the three stage sections; see applicationTracking.service.js#statusHistory.
router.get(
  '/:id/status-history',
  authorize('application_tracks', 'read'),
  validate({ params: idParam }),
  controller.statusHistory,
);

// Moves a track's position in the ranked "Waiting to start" queue — see
// applicationTracking.service.js#reorder for the fractional-rank scheme. Deliberately gated on the
// SAME real permission that already gates moveToBuild ('ideas:moveToBuild', not
// 'application_tracks:update') — this is the same underlying decision ("who decides what gets
// built and in what order"), just reused rather than split into a second grant.
router.patch(
  '/:id/reorder',
  authorize('ideas', 'moveToBuild'),
  validate({ params: idParam, body: reorderBody }),
  controller.reorder,
);

router.patch('/:id/go-live', authorize('application_tracks', 'update'), validate({ params: idParam }), controller.goLive);

router.patch('/:id/hold', authorize('application_tracks', 'update'), validate({ params: idParam, body: holdBody }), controller.hold);
router.patch('/:id/resume', authorize('application_tracks', 'update'), validate({ params: idParam }), controller.resume);
router.patch('/:id/cancel', authorize('application_tracks', 'update'), validate({ params: idParam, body: cancelBody }), controller.cancel);

module.exports = router;

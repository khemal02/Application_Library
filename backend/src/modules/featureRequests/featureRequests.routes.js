const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const { requireRecordOwnership } = require('../../middlewares/ownership.middleware');
const validate = require('../../middlewares/validate.middleware');
const { FeatureRequest } = require('../../models');
const controller = require('./featureRequests.controller');
const {
  create, update, submitReview, addParticipants, panelCandidatesQuery, moveToBuild,
} = require('./featureRequests.validator');

const router = express.Router();
router.use(authenticate);

const ownFeatureRequestOnly = requireRecordOwnership(() => FeatureRequest, 'submittedBy');

// Own RBAC resource ('feature_requests', not 'ideas') — see 20260130000036, which grants it the
// same role/action shape 'ideas' already had.
router.get('/analytics', authorize('feature_requests', 'read'), controller.analytics);
router.get('/', authorize('feature_requests', 'read'), controller.list);
router.get('/:id', authorize('feature_requests', 'read'), controller.getById);
router.get('/:id/status-history', authorize('feature_requests', 'read'), controller.statusHistory);
router.post('/', authorize('feature_requests', 'create'), validate(create), controller.create);
router.put('/:id', authorize('feature_requests', 'update'), ownFeatureRequestOnly, validate(update), controller.update);
// Gated only on the coarse 'feature_requests:read' — the real authorization is panel membership,
// enforced in the service (submitReview's own myRow lookup). Same shape as ideas.routes.js.
router.post('/:id/reviews', authorize('feature_requests', 'read'), validate(submitReview), controller.submitReview);
router.get('/:id/panel-candidates', authorize('feature_requests', 'update'), validate({ query: panelCandidatesQuery }), controller.panelCandidates);
router.post('/:id/panel', authorize('feature_requests', 'update'), validate(addParticipants), controller.addParticipants);
router.delete('/:id/panel/:userId', authorize('feature_requests', 'update'), controller.removeParticipant);
// Narrow, separately-permissioned action (D3/1a): names the Development stage's assignee and
// starts it — the real gap here, since approving a feature request never picks anyone (unlike an
// idea, which already requires a track owner). Not `feature_requests:update` — CEO/Manager/Admin
// get this automatically via their existing resource-level `manage` grant (hasPermission's
// wildcard rule); nobody else does unless explicitly granted later. See
// featureRequests.service.js#moveToBuild.
router.patch('/:id/move-to-build', authorize('feature_requests', 'moveToBuild'), validate(moveToBuild), controller.moveToBuild);
router.delete('/:id', authorize('feature_requests', 'delete'), ownFeatureRequestOnly, controller.remove);

module.exports = router;

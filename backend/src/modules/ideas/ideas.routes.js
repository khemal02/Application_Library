const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const { requireRecordOwnership } = require('../../middlewares/ownership.middleware');
const validate = require('../../middlewares/validate.middleware');
const { Idea } = require('../../models');
const controller = require('./ideas.controller');
const {
  create, update, submitReview, addParticipants, panelCandidatesQuery, moveToBuild,
} = require('./ideas.validator');

const router = express.Router();
router.use(authenticate);

const ownIdeaOnly = requireRecordOwnership(() => Idea, 'submittedBy');

router.get('/analytics', authorize('ideas', 'read'), controller.analytics);
// Gated on the coarse `ideas:read` permission, not `ideas:review` — same reasoning as /:id/reviews
// below: R4 makes an approver "any active user" via panel membership, not a role-based permission,
// so an Employee approver who's the deciding vote must be able to reach this (they need it to pick
// an owner) even though they hold no `ideas:review` grant at all. `ideas:read` is universal, so
// this never actually widens who can call it beyond "anyone who can see ideas."
router.get('/eligible-owners', authorize('ideas', 'read'), controller.eligibleOwners);
router.get('/', authorize('ideas', 'read'), controller.list);
router.get('/:id', authorize('ideas', 'read'), controller.getById);
router.get('/:id/status-history', authorize('ideas', 'read'), controller.statusHistory);
router.post('/', authorize('ideas', 'create'), validate(create), controller.create);
router.put('/:id', authorize('ideas', 'update'), ownIdeaOnly, validate(update), controller.update);
// Every panel member's own verdict — reviewer or approver — goes through this one endpoint; there
// is no separate /decision route. Gated only on the coarse `ideas:read` permission (everyone who
// can see an idea has it) rather than `ideas:review` — R4 makes a reviewer "any active user", so
// the old review-role-only permission would wrongly block a plain Employee reviewer before they
// ever reach the real check. The real authorization is entirely in the service: you must have a
// panel row for yourself (ideas.service.js#submitReview's `myRow` lookup) — panel membership IS
// the authorization now, not a role-based permission.
router.post('/:id/reviews', authorize('ideas', 'read'), validate(submitReview), controller.submitReview);
// Panel management (R6/R7): gated here only on the coarse `ideas:update` permission an Employee
// submitter already holds for their own idea — the actual "submitter, CEO, or Admin" check (R7)
// happens in the service, since ownership middleware alone can't express the CEO/Admin exception.
router.get('/:id/panel-candidates', authorize('ideas', 'update'), validate({ query: panelCandidatesQuery }), controller.panelCandidates);
router.post('/:id/panel', authorize('ideas', 'update'), validate(addParticipants), controller.addParticipants);
router.delete('/:id/panel/:userId', authorize('ideas', 'update'), controller.removeParticipant);
// Narrow, separately-permissioned action (D3/1a): names the Development stage's assignee and
// starts it — distinct from approving, which already requires a track OWNER but never touches who
// actually builds it. Not `ideas:update` — CEO/Manager/Admin get this automatically via their
// existing resource-level `manage` grant (hasPermission's wildcard rule); nobody else does unless
// explicitly granted later. See ideas.service.js#moveToBuild.
router.patch('/:id/move-to-build', authorize('ideas', 'moveToBuild'), validate(moveToBuild), controller.moveToBuild);
router.delete('/:id', authorize('ideas', 'delete'), ownIdeaOnly, controller.remove);

module.exports = router;

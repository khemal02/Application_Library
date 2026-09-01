const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const validate = require('../../middlewares/validate.middleware');
const controller = require('./issues.controller');
const {
  create, idParams, triageBody, assignBody, noteBody,
} = require('./issues.validator');

// Nested under /applications/:applicationId/issues (mergeParams so req.params.applicationId
// reaches every handler). No generic PUT/DELETE — see Stage 1b's endpoint list; the fine-grained
// "who may do what" gate for every write below is enforced in issues.service.js, not here — the
// route-level authorize() calls are deliberately coarse, same "route is coarse, service is the
// real gate" shape changeRequests.routes.js already uses.
const router = express.Router({ mergeParams: true });
router.use(authenticate);

router.get('/', authorize('issues', 'read'), controller.list);
router.get('/assignee-candidates', authorize('issues', 'read'), controller.assigneeCandidates);
router.get('/:id', authorize('issues', 'read'), controller.getById);
router.post('/', authorize('issues', 'create'), validate(create), controller.create);

router.patch(
  '/:id/triage', authorize('issues', 'update'),
  validate({ params: idParams, body: triageBody }), controller.triage,
);
router.patch(
  '/:id/assign', authorize('issues', 'update'),
  validate({ params: idParams, body: assignBody }), controller.assign,
);
router.patch(
  '/:id/resolve', authorize('issues', 'update'),
  validate({ params: idParams, body: noteBody }), controller.resolve,
);
router.patch(
  '/:id/reopen', authorize('issues', 'update'),
  validate({ params: idParams, body: noteBody }), controller.reopen,
);
// Stage 3 — no body needed, everything server-derived from the issue itself.
router.post(
  '/:id/convert', authorize('issues', 'update'),
  validate({ params: idParams }), controller.convert,
);

module.exports = router;

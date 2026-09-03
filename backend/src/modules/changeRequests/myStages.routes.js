const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const validate = require('../../middlewares/validate.middleware');
const controller = require('./changeRequests.controller');
const { myStagesQuery } = require('./changeRequests.validator');

// Deliberately its own tiny router, not folded into changeRequests.routes.js — that router is
// built with `mergeParams: true` and expects to be mounted under
// /applications/:applicationId/change-requests; a route added there could never be a top-level,
// cross-application endpoint. This one is mounted directly at /change-requests/my-stages instead
// (see routes/index.js).
const router = express.Router();
router.use(authenticate);
router.get('/', authorize('change_requests', 'read'), validate({ query: myStagesQuery }), controller.myAssignedStages);

module.exports = router;

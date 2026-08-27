const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const controller = require('./auditLogs.controller');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('audit_logs', 'read'), controller.list);

module.exports = router;

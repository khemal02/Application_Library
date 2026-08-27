const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const { requireApplicationAccess } = require('../../middlewares/ownership.middleware');
const validate = require('../../middlewares/validate.middleware');
const scopeToParent = require('../../utils/scopeToParent');
const controller = require('./architectureDocs.controller');
const { upsert } = require('./architectureDocs.validator');

const router = express.Router({ mergeParams: true });
router.use(authenticate, scopeToParent('applicationId'));

router.get('/', authorize('architecture_docs', 'read'), controller.list);
router.get('/:id', authorize('architecture_docs', 'read'), controller.getById);
router.put('/', authorize('architecture_docs', 'update'), requireApplicationAccess('applicationId'), validate(upsert), controller.upsert);
router.delete('/:id', authorize('architecture_docs', 'delete'), requireApplicationAccess('applicationId'), controller.remove);

module.exports = router;

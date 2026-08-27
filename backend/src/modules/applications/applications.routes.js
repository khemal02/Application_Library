const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const { requireApplicationAccess } = require('../../middlewares/ownership.middleware');
const validate = require('../../middlewares/validate.middleware');
const controller = require('./applications.controller');
const { create, update } = require('./applications.validator');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('applications', 'read'), controller.list);
router.get('/:id', authorize('applications', 'read'), controller.getById);
router.post('/', authorize('applications', 'create'), validate(create), controller.create);
router.put('/:id', authorize('applications', 'update'), requireApplicationAccess('id'), validate(update), controller.update);
router.delete('/:id', authorize('applications', 'delete'), requireApplicationAccess('id'), controller.remove);

module.exports = router;

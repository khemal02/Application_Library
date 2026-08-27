const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const validate = require('../../middlewares/validate.middleware');
const controller = require('./roles.controller');
const { create, update, setPermissions } = require('./roles.validator');

const router = express.Router();
router.use(authenticate);

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', authorize('roles', 'create'), validate(create), controller.create);
router.put('/:id', authorize('roles', 'update'), validate(update), controller.update);
router.delete('/:id', authorize('roles', 'delete'), controller.remove);
router.put('/:id/permissions', authorize('roles', 'update'), validate(setPermissions), controller.setPermissions);

module.exports = router;

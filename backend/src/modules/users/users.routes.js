const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const validate = require('../../middlewares/validate.middleware');
const controller = require('./users.controller');
const { create, update, updateProfile } = require('./users.validator');

const router = express.Router();
router.use(authenticate);

router.patch('/me/profile', validate(updateProfile), controller.updateProfile);

router.get('/', authorize('users', 'read'), controller.list);
router.get('/:id', authorize('users', 'read'), controller.getById);
router.post('/', authorize('users', 'create'), validate(create), controller.create);
router.put('/:id', authorize('users', 'update'), validate(update), controller.update);
router.delete('/:id', authorize('users', 'delete'), controller.remove);

module.exports = router;

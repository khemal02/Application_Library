const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const validate = require('../../middlewares/validate.middleware');
const controller = require('./departments.controller');
const { create, update } = require('./departments.validator');

const router = express.Router();
router.use(authenticate);

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', authorize('departments', 'create'), validate(create), controller.create);
router.put('/:id', authorize('departments', 'update'), validate(update), controller.update);
router.delete('/:id', authorize('departments', 'delete'), controller.remove);

module.exports = router;

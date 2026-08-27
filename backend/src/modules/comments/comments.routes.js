const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const validate = require('../../middlewares/validate.middleware');
const controller = require('./comments.controller');
const { create, listQuery } = require('./comments.validator');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('comments', 'read'), validate({ query: listQuery }), controller.list);
router.post('/', authorize('comments', 'create'), validate(create), controller.create);
router.delete('/:id', authorize('comments', 'read'), controller.remove);

module.exports = router;

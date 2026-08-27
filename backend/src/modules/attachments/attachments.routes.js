const express = require('express');
const Joi = require('joi');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const validate = require('../../middlewares/validate.middleware');
const upload = require('../../middlewares/upload.middleware');
const controller = require('./attachments.controller');

const router = express.Router();
router.use(authenticate);

const entityQuery = Joi.object({ entityType: Joi.string().max(60).required(), entityId: Joi.string().uuid().required() }).unknown(true);
const uploadBody = Joi.object({ entityType: Joi.string().max(60).required(), entityId: Joi.string().uuid().required() }).unknown(true);

router.get('/', authorize('attachments', 'read'), validate({ query: entityQuery }), controller.listForEntity);
router.post('/', authorize('attachments', 'create'), upload.single('file'), validate(uploadBody), controller.upload);
router.delete('/:id', authorize('attachments', 'create'), controller.remove);

module.exports = router;

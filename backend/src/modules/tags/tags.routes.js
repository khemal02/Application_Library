const express = require('express');
const Joi = require('joi');
const { authenticate } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const controller = require('./tags.controller');

const router = express.Router();
router.use(authenticate);

const entityQuery = Joi.object({ entityType: Joi.string().max(60).required(), entityId: Joi.string().uuid().required() }).unknown(true);
const setBody = Joi.object({
  entityType: Joi.string().max(60).required(),
  entityId: Joi.string().uuid().required(),
  tags: Joi.array().items(Joi.string().max(60)).required(),
});

router.get('/', controller.list);
router.get('/for-entity', validate({ query: entityQuery }), controller.listForEntity);
router.put('/for-entity', validate(setBody), controller.setForEntity);

module.exports = router;

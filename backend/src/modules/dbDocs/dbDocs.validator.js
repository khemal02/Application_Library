const Joi = require('joi');

const create = Joi.object({
  applicationId: Joi.string().uuid().required(),
  docTableName: Joi.string().max(120).required(),
  description: Joi.string().allow('', null),
  columns: Joi.array().items(Joi.object().unknown(true)).allow(null),
  relationships: Joi.array().items(Joi.object().unknown(true)).allow(null),
  constraints: Joi.array().items(Joi.object().unknown(true)).allow(null),
});

const update = create.fork(['applicationId', 'docTableName'], (s) => s.optional());

module.exports = { create, update };

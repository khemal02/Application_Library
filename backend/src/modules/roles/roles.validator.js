const Joi = require('joi');

const create = Joi.object({
  name: Joi.string().max(50).required(),
  label: Joi.string().max(100).required(),
  description: Joi.string().allow('', null),
});

const update = Joi.object({
  label: Joi.string().max(100),
  description: Joi.string().allow('', null),
});

const setPermissions = Joi.object({
  permissions: Joi.array().items(
    Joi.object({ resource: Joi.string().max(60).required(), action: Joi.string().max(20).required() }),
  ).required(),
});

module.exports = { create, update, setPermissions };

const Joi = require('joi');

const create = Joi.object({
  name: Joi.string().max(120).required(),
  description: Joi.string().allow('', null),
});

const update = Joi.object({
  name: Joi.string().max(120),
  description: Joi.string().allow('', null),
});

module.exports = { create, update };

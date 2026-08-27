const Joi = require('joi');

const create = Joi.object({
  applicationId: Joi.string().uuid().required(),
  title: Joi.string().max(200).required(),
  description: Joi.string().allow('', null),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical'),
  status: Joi.string().valid('active', 'monitoring', 'resolved'),
  workaround: Joi.string().allow('', null),
});

const update = create.fork(['applicationId', 'title'], (s) => s.optional());

module.exports = { create, update };

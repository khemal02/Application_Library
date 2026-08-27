const Joi = require('joi');

const create = Joi.object({
  applicationId: Joi.string().uuid().required(),
  title: Joi.string().max(200).required(),
  description: Joi.string().allow('', null),
  targetQuarter: Joi.string().max(20).allow('', null),
  status: Joi.string().valid('proposed', 'planned', 'in_progress', 'done'),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical'),
});

const update = create.fork(['applicationId', 'title'], (s) => s.optional());

module.exports = { create, update };

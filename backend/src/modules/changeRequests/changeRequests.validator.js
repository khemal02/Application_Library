const Joi = require('joi');

const create = Joi.object({
  applicationId: Joi.string().uuid().required(),
  title: Joi.string().required(),
  description: Joi.string().allow('', null),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical'),
  status: Joi.string().valid('pending', 'in_review', 'approved', 'rejected', 'implemented'),
  requestedBy: Joi.string().uuid().allow(null),
});

const update = create.fork(['applicationId', 'title'], (s) => s.optional());

module.exports = { create, update };

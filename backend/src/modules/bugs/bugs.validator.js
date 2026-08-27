const Joi = require('joi');

const create = Joi.object({
  applicationId: Joi.string().uuid().required(),
  title: Joi.string().max(200).required(),
  description: Joi.string().allow('', null),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical'),
  status: Joi.string().valid('open', 'in_progress', 'resolved', 'wont_fix'),
  reportedBy: Joi.string().uuid().allow(null),
  resolvedBy: Joi.string().uuid().allow(null),
  reportedDate: Joi.date().allow(null),
  resolvedDate: Joi.date().allow(null),
});

const update = create.fork(['applicationId', 'title'], (s) => s.optional());

module.exports = { create, update };

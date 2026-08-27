const Joi = require('joi');

const create = Joi.object({
  applicationId: Joi.string().uuid().required(),
  name: Joi.string().max(200).required(),
  description: Joi.string().allow('', null),
  status: Joi.string().valid('planned', 'in_progress', 'completed', 'blocked'),
  assignedDeveloperId: Joi.string().uuid().allow(null),
  estimatedTime: Joi.string().max(60).allow('', null),
  completionDate: Joi.date().allow(null),
  dependencyIds: Joi.array().items(Joi.string().uuid()),
});

const update = create.fork(['applicationId', 'name'], (s) => s.optional());

module.exports = { create, update };

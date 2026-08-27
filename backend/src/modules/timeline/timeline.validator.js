const Joi = require('joi');

const create = Joi.object({
  applicationId: Joi.string().uuid().required(),
  title: Joi.string().max(200).required(),
  description: Joi.string().allow('', null),
  dueDate: Joi.date().allow(null),
  status: Joi.string().valid('upcoming', 'in_progress', 'completed', 'delayed'),
});

const update = create.fork(['applicationId', 'title'], (s) => s.optional());

module.exports = { create, update };

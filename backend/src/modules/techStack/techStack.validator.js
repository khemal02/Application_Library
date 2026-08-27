const Joi = require('joi');

const create = Joi.object({
  applicationId: Joi.string().uuid().required(),
  category: Joi.string().valid('frontend', 'backend', 'database', 'ai_model', 'framework', 'library', 'cloud', 'devops').required(),
  name: Joi.string().max(120).required(),
  version: Joi.string().max(40).allow('', null),
  notes: Joi.string().allow('', null),
});

const update = create.fork(['applicationId', 'category', 'name'], (s) => s.optional());

module.exports = { create, update };

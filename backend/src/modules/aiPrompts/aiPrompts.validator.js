const Joi = require('joi');

const create = Joi.object({
  applicationId: Joi.string().uuid().required(),
  title: Joi.string().max(200).required(),
  promptText: Joi.string().required(),
  promptType: Joi.string().max(60).allow('', null),
  aiModel: Joi.string().max(80).allow('', null),
  outputSummary: Joi.string().allow('', null),
  version: Joi.string().max(20),
});

const update = create.fork(['applicationId', 'title', 'promptText'], (s) => s.optional());

module.exports = { create, update };

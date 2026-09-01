const Joi = require('joi');
const { INDUSTRIES, FUNCTIONAL_AREAS } = require('../../utils/validators');

const create = Joi.object({
  name: Joi.string().max(200).required(),
  description: Joi.string().allow('', null),
  category: Joi.string().max(80).allow('', null),
  industry: Joi.string().valid(...INDUSTRIES).allow('', null),
  functionalArea: Joi.string().valid(...FUNCTIONAL_AREAS).allow('', null),
  ownerId: Joi.string().uuid().allow(null),
  departmentId: Joi.string().uuid().allow(null),
  status: Joi.string().valid('development', 'testing', 'deployment'),
  startDate: Joi.date().allow(null),
  releaseDate: Joi.date().allow(null),
  currentVersion: Joi.string().max(30).allow('', null),
  repositoryUrl: Joi.string().uri().allow('', null),
  deploymentUrl: Joi.string().uri().allow('', null),
});

const update = create.fork(['name'], (s) => s.optional());

module.exports = { create, update };

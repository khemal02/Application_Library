const Joi = require('joi');

const create = Joi.object({
  applicationId: Joi.string().uuid().required(),
  version: Joi.string().max(30).required(),
  releaseDate: Joi.date().allow(null),
  newFeatures: Joi.array().items(Joi.string()).default([]),
  bugFixes: Joi.array().items(Joi.string()).default([]),
  breakingChanges: Joi.array().items(Joi.string()).default([]),
});

const update = create.fork(['applicationId', 'version'], (s) => s.optional());

module.exports = { create, update };

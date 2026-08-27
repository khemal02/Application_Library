const Joi = require('joi');

const create = Joi.object({
  applicationId: Joi.string().uuid().required(),
  endpoint: Joi.string().max(300).required(),
  method: Joi.string().valid('GET', 'POST', 'PUT', 'PATCH', 'DELETE').required(),
  description: Joi.string().allow('', null),
  requestSchema: Joi.object().unknown(true).allow(null),
  responseSchema: Joi.object().unknown(true).allow(null),
  errorCodes: Joi.object().unknown(true).allow(null),
});

const update = create.fork(['applicationId', 'endpoint', 'method'], (s) => s.optional());

module.exports = { create, update };

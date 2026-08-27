const Joi = require('joi');

const DOC_TYPES = ['high_level', 'folder_structure', 'api_flow', 'db_design', 'auth_flow', 'microservice_diagram', 'deployment_diagram'];

const upsert = Joi.object({
  applicationId: Joi.string().uuid().required(),
  docType: Joi.string().valid(...DOC_TYPES).required(),
  title: Joi.string().max(200).allow('', null),
  contentMarkdown: Joi.string().allow('', null),
  diagramUrl: Joi.string().uri().allow('', null),
});

module.exports = { upsert, DOC_TYPES };

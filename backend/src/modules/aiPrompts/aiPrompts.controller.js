const { createCrudController } = require('../../utils/controllerFactory');
const service = require('./aiPrompts.service');

module.exports = createCrudController(service, { entityName: 'AI prompt', entityType: 'ai_prompt' });

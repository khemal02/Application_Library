const { createCrudController } = require('../../utils/controllerFactory');
const service = require('./techStack.service');

module.exports = createCrudController(service, { entityName: 'Tech stack entry', entityType: 'tech_stack' });

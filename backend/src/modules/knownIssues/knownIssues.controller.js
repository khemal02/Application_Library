const { createCrudController } = require('../../utils/controllerFactory');
const service = require('./knownIssues.service');

module.exports = createCrudController(service, { entityName: 'Known issue', entityType: 'known_issue' });

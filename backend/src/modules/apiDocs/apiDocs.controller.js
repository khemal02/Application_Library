const { createCrudController } = require('../../utils/controllerFactory');
const service = require('./apiDocs.service');

module.exports = createCrudController(service, { entityName: 'API endpoint', entityType: 'api_endpoint' });

const { createCrudController } = require('../../utils/controllerFactory');
const service = require('./changeRequests.service');

module.exports = createCrudController(service, { entityName: 'Change request', entityType: 'change_request' });

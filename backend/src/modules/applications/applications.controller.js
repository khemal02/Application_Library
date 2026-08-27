const { createCrudController } = require('../../utils/controllerFactory');
const service = require('./applications.service');

module.exports = createCrudController(service, { entityName: 'Application', entityType: 'application' });

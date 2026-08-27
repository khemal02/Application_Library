const { createCrudController } = require('../../utils/controllerFactory');
const service = require('./departments.service');

module.exports = createCrudController(service, { entityName: 'Department', entityType: 'department' });

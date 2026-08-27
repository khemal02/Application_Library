const { createCrudController } = require('../../utils/controllerFactory');
const service = require('./features.service');

module.exports = createCrudController(service, { entityName: 'Feature', entityType: 'feature' });

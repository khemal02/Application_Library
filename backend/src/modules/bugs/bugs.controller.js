const { createCrudController } = require('../../utils/controllerFactory');
const service = require('./bugs.service');

module.exports = createCrudController(service, { entityName: 'Bug', entityType: 'bug' });

const { createCrudController } = require('../../utils/controllerFactory');
const service = require('./releases.service');

module.exports = createCrudController(service, { entityName: 'Release note', entityType: 'release_note' });

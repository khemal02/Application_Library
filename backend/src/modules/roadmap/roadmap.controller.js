const { createCrudController } = require('../../utils/controllerFactory');
const service = require('./roadmap.service');

module.exports = createCrudController(service, { entityName: 'Roadmap item', entityType: 'roadmap_item' });

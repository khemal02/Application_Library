const { createCrudController } = require('../../utils/controllerFactory');
const service = require('./timeline.service');

module.exports = createCrudController(service, { entityName: 'Timeline milestone', entityType: 'timeline_milestone' });

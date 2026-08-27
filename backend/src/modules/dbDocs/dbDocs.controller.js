const { createCrudController } = require('../../utils/controllerFactory');
const service = require('./dbDocs.service');

module.exports = createCrudController(service, { entityName: 'DB table doc', entityType: 'db_table_doc' });

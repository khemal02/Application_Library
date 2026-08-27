const { createCrudService } = require('../../utils/crudFactory');
const { DbTableDoc } = require('../../models');

module.exports = createCrudService(DbTableDoc, {
  filterableFields: ['applicationId'],
  defaultSort: [['docTableName', 'ASC']],
  notFoundMessage: 'DB table doc not found',
});

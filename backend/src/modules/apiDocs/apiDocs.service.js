const { createCrudService } = require('../../utils/crudFactory');
const { ApiEndpoint } = require('../../models');

module.exports = createCrudService(ApiEndpoint, {
  searchableFields: ['endpoint', 'description'],
  filterableFields: ['applicationId', 'method'],
  defaultSort: [['endpoint', 'ASC']],
  notFoundMessage: 'API endpoint doc not found',
});

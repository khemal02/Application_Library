const { createCrudService } = require('../../utils/crudFactory');
const { Department } = require('../../models');

module.exports = createCrudService(Department, {
  searchableFields: ['name'],
  defaultSort: [['name', 'ASC']],
  notFoundMessage: 'Department not found',
});

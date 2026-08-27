const { createCrudService } = require('../../utils/crudFactory');
const { ApplicationTechStack } = require('../../models');

module.exports = createCrudService(ApplicationTechStack, {
  filterableFields: ['applicationId', 'category'],
  defaultSort: [['category', 'ASC']],
  notFoundMessage: 'Tech stack entry not found',
});

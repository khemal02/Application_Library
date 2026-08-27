const { createCrudService } = require('../../utils/crudFactory');
const { TimelineMilestone } = require('../../models');

module.exports = createCrudService(TimelineMilestone, {
  searchableFields: ['title', 'description'],
  filterableFields: ['applicationId', 'status'],
  defaultSort: [['dueDate', 'ASC']],
  notFoundMessage: 'Timeline milestone not found',
});

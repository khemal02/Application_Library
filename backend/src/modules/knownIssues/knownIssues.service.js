const { createCrudService } = require('../../utils/crudFactory');
const { KnownIssue } = require('../../models');

module.exports = createCrudService(KnownIssue, {
  searchableFields: ['title', 'description'],
  filterableFields: ['applicationId', 'severity', 'status'],
  notFoundMessage: 'Known issue not found',
});

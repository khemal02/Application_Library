const { createCrudService } = require('../../utils/crudFactory');
const { RoadmapItem } = require('../../models');

module.exports = createCrudService(RoadmapItem, {
  searchableFields: ['title', 'description'],
  filterableFields: ['applicationId', 'status', 'priority'],
  notFoundMessage: 'Roadmap item not found',
});

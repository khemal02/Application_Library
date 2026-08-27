const { createCrudService } = require('../../utils/crudFactory');
const { BugHistory, User } = require('../../models');

const base = createCrudService(BugHistory, {
  searchableFields: ['title', 'description'],
  filterableFields: ['applicationId', 'severity', 'status'],
  include: [
    { model: User, as: 'reporter', attributes: ['id', 'name'] },
    { model: User, as: 'resolver', attributes: ['id', 'name'] },
  ],
  notFoundMessage: 'Bug not found',
});

async function create(payload, req) {
  return BugHistory.create({ ...payload, reportedBy: payload.reportedBy || req?.user?.id });
}

module.exports = { ...base, create };

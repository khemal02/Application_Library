const { createCrudService } = require('../../utils/crudFactory');
const { ChangeRequest, User, Role } = require('../../models');

const base = createCrudService(ChangeRequest, {
  searchableFields: ['title', 'description'],
  filterableFields: ['applicationId', 'status', 'priority'],
  include: [{
    model: User,
    as: 'requester',
    attributes: ['id', 'name'],
    include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'label'] }],
  }],
  notFoundMessage: 'Change request not found',
});

async function create(payload, req) {
  return ChangeRequest.create({ ...payload, requestedBy: payload.requestedBy || req?.user?.id });
}

module.exports = { ...base, create };

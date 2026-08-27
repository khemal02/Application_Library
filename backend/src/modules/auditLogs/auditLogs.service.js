const { AuditLog, User, Role } = require('../../models');
const { createCrudService } = require('../../utils/crudFactory');

module.exports = createCrudService(AuditLog, {
  filterableFields: ['entityType', 'entityId', 'userId', 'action'],
  defaultSort: [['createdAt', 'DESC']],
  include: [{
    model: User,
    as: 'user',
    attributes: ['id', 'name', 'email'],
    include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'label'] }],
  }],
  notFoundMessage: 'Audit log entry not found',
});

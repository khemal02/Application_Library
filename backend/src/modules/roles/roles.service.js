const { createCrudService } = require('../../utils/crudFactory');
const { Role, RolePermission } = require('../../models');
const ApiError = require('../../utils/ApiError');

const base = createCrudService(Role, {
  searchableFields: ['name', 'label'],
  defaultSort: [['label', 'ASC']],
  include: [{ model: RolePermission, as: 'permissions' }],
  notFoundMessage: 'Role not found',
});

async function setPermissions(roleId, permissions) {
  const role = await Role.findByPk(roleId);
  if (!role) throw ApiError.notFound('Role not found');

  await RolePermission.destroy({ where: { roleId } });
  await RolePermission.bulkCreate(permissions.map((p) => ({ roleId, resource: p.resource, action: p.action })));
  return base.getById(roleId);
}

module.exports = { ...base, setPermissions };

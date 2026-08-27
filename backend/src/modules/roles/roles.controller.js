const { createCrudController } = require('../../utils/controllerFactory');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./roles.service');

const controller = createCrudController(service, { entityName: 'Role', entityType: 'role' });

controller.setPermissions = asyncHandler(async (req, res) => {
  const role = await service.setPermissions(req.params.id, req.body.permissions);
  return ApiResponse.success(res, role, 'Permissions updated');
});

module.exports = controller;

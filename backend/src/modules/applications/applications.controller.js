const { createCrudController } = require('../../utils/controllerFactory');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./applications.service');

const controller = createCrudController(service, { entityName: 'Application', entityType: 'application' });

controller.eligibleOwners = asyncHandler(async (req, res) => {
  const users = await service.eligibleOwners();
  return ApiResponse.success(res, users);
});

controller.getOrigin = asyncHandler(async (req, res) => {
  const origin = await service.getOrigin(req.params.id);
  return ApiResponse.success(res, origin);
});

module.exports = controller;

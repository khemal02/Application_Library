const { createCrudController } = require('../../utils/controllerFactory');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./applications.service');

const controller = createCrudController(service, { entityName: 'Application', entityType: 'application' });

controller.eligibleOwners = asyncHandler(async (req, res) => {
  const users = await service.eligibleOwners();
  return ApiResponse.success(res, users);
});

module.exports = controller;

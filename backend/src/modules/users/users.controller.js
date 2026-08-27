const { createCrudController } = require('../../utils/controllerFactory');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./users.service');

const controller = createCrudController(service, { entityName: 'User', entityType: 'user' });

controller.updateProfile = asyncHandler(async (req, res) => {
  const user = await service.updateProfile(req.user.id, req.body);
  return ApiResponse.success(res, user, 'Profile updated');
});

module.exports = controller;

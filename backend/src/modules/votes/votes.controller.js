const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./votes.service');

const toggle = asyncHandler(async (req, res) => {
  const result = await service.toggle(req.user.id, req.body);
  return ApiResponse.success(res, result);
});

const summary = asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.query;
  const result = await service.summary(entityType, entityId, req.user.id);
  return ApiResponse.success(res, result);
});

module.exports = { toggle, summary };

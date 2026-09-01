const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./dashboard.service');

const summary = asyncHandler(async (req, res) => {
  const data = await service.getSummary(req.user.id);
  return ApiResponse.success(res, data);
});

module.exports = { summary };

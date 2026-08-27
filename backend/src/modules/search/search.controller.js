const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./search.service');

const search = asyncHandler(async (req, res) => {
  const results = await service.globalSearch(req.query.q, Number(req.query.limit) || 8);
  return ApiResponse.success(res, results);
});

module.exports = { search };

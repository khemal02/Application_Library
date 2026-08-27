const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./auditLogs.service');

const list = asyncHandler(async (req, res) => {
  const { items, pagination } = await service.list(req.query);
  return ApiResponse.paginated(res, items, pagination);
});

module.exports = { list };

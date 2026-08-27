const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./notifications.service');

const list = asyncHandler(async (req, res) => {
  const { items, pagination } = await service.list(req.user.id, req.query);
  return ApiResponse.paginated(res, items, pagination);
});

const unreadCount = asyncHandler(async (req, res) => {
  const result = await service.unreadCount(req.user.id);
  return ApiResponse.success(res, result);
});

const markRead = asyncHandler(async (req, res) => {
  const notification = await service.markRead(req.user.id, req.params.id);
  return ApiResponse.success(res, notification);
});

const markAllRead = asyncHandler(async (req, res) => {
  const result = await service.markAllRead(req.user.id);
  return ApiResponse.success(res, result);
});

module.exports = { list, unreadCount, markRead, markAllRead };

const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./comments.service');

const list = asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.query;
  const comments = await service.listByEntity(entityType, entityId);
  return ApiResponse.success(res, comments);
});

const create = asyncHandler(async (req, res) => {
  const comment = await service.create(req.user, req.body);
  return ApiResponse.created(res, comment, 'Comment added');
});

const update = asyncHandler(async (req, res) => {
  const comment = await service.update(req.params.id, req.body, req.user);
  return ApiResponse.success(res, comment, 'Comment updated');
});

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id, req.user);
  return ApiResponse.noContent(res);
});

module.exports = {
  list, create, update, remove,
};

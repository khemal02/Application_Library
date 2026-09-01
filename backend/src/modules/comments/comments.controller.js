const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const { logAction } = require('../../utils/auditLogger');
const service = require('./comments.service');

const list = asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.query;
  const comments = await service.listByEntity(entityType, entityId);
  return ApiResponse.success(res, comments);
});

const create = asyncHandler(async (req, res) => {
  const comment = await service.create(req.user, req.body);
  await logAction({ req, action: 'create', entityType: 'comment', entityId: comment.id, newValue: comment.toJSON() });
  return ApiResponse.created(res, comment, 'Comment added');
});

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id, req.user);
  await logAction({ req, action: 'delete', entityType: 'comment', entityId: req.params.id });
  return ApiResponse.noContent(res);
});

module.exports = { list, create, remove };

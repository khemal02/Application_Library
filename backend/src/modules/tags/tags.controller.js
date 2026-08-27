const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./tags.service');

const list = asyncHandler(async (req, res) => {
  const tags = await service.listAll(req.query.search);
  return ApiResponse.success(res, tags);
});

const listForEntity = asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.query;
  const tags = await service.listForEntity(entityType, entityId);
  return ApiResponse.success(res, tags);
});

const setForEntity = asyncHandler(async (req, res) => {
  const { entityType, entityId, tags } = req.body;
  const result = await service.setForEntity(entityType, entityId, tags);
  return ApiResponse.success(res, result, 'Tags updated');
});

module.exports = { list, listForEntity, setForEntity };

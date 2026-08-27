const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const { logAction } = require('../../utils/auditLogger');
const service = require('./architectureDocs.service');

const list = asyncHandler(async (req, res) => {
  const { items, pagination } = await service.list(req.query);
  return ApiResponse.paginated(res, items, pagination);
});

const getById = asyncHandler(async (req, res) => {
  const doc = await service.getById(req.params.id);
  return ApiResponse.success(res, doc);
});

const upsert = asyncHandler(async (req, res) => {
  const doc = await service.upsert(req.body, req);
  await logAction({ req, action: 'update', entityType: 'architecture_doc', entityId: doc.id, newValue: doc.toJSON() });
  return ApiResponse.success(res, doc, 'Architecture document saved');
});

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id);
  await logAction({ req, action: 'delete', entityType: 'architecture_doc', entityId: req.params.id });
  return ApiResponse.noContent(res);
});

module.exports = { list, getById, upsert, remove };

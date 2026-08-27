const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const { logAction } = require('../../utils/auditLogger');
const service = require('./attachments.service');

const listForEntity = asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.query;
  const attachments = await service.listForEntity(entityType, entityId);
  return ApiResponse.success(res, attachments);
});

const upload = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded');
  const { entityType, entityId } = req.body;
  const attachment = await service.upload({ file: req.file, entityType, entityId, uploadedBy: req.user.id });
  await logAction({ req, action: 'create', entityType: 'attachment', entityId: attachment.id, newValue: attachment });
  return ApiResponse.created(res, attachment, 'File uploaded');
});

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id, req.user);
  await logAction({ req, action: 'delete', entityType: 'attachment', entityId: req.params.id });
  return ApiResponse.noContent(res);
});

module.exports = { listForEntity, upload, remove };

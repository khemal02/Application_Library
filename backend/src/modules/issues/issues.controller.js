const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const { logAction } = require('../../utils/auditLogger');
const service = require('./issues.service');

// Hand-written throughout — issues has no generic PUT/DELETE surface (see Stage 1b's endpoint
// list), so this doesn't build on controllerFactory.js's createCrudController.
module.exports = {
  list: asyncHandler(async (req, res) => {
    const records = await service.list(req.params.applicationId, req.query, req);
    return ApiResponse.success(res, records);
  }),

  getById: asyncHandler(async (req, res) => {
    const record = await service.getById(req.params.applicationId, req.params.id, req);
    return ApiResponse.success(res, record);
  }),

  create: asyncHandler(async (req, res) => {
    const record = await service.create(req.params.applicationId, req.body, req);
    await logAction({
      req, action: 'create', entityType: 'issue', entityId: record.id, newValue: record.toJSON(),
    });
    return ApiResponse.created(res, record, 'Issue reported');
  }),

  triage: asyncHandler(async (req, res) => {
    const record = await service.triage(req.params.applicationId, req.params.id, req.body, req);
    await logAction({
      req, action: 'update', entityType: 'issue', entityId: req.params.id, newValue: record.toJSON(),
    });
    return ApiResponse.success(res, record, 'Issue triaged');
  }),

  assign: asyncHandler(async (req, res) => {
    const record = await service.assign(req.params.applicationId, req.params.id, req.body, req);
    await logAction({
      req, action: 'update', entityType: 'issue', entityId: req.params.id, newValue: record.toJSON(),
    });
    return ApiResponse.success(res, record, 'Assignment updated');
  }),

  resolve: asyncHandler(async (req, res) => {
    const record = await service.resolve(req.params.applicationId, req.params.id, req.body, req);
    await logAction({
      req, action: 'update', entityType: 'issue', entityId: req.params.id, newValue: record.toJSON(),
    });
    return ApiResponse.success(res, record, 'Issue resolved');
  }),

  reopen: asyncHandler(async (req, res) => {
    const record = await service.reopen(req.params.applicationId, req.params.id, req.body, req);
    await logAction({
      req, action: 'update', entityType: 'issue', entityId: req.params.id, newValue: record.toJSON(),
    });
    return ApiResponse.success(res, record, 'Issue reopened');
  }),

  convert: asyncHandler(async (req, res) => {
    const record = await service.convert(req.params.applicationId, req.params.id, req);
    await logAction({
      req, action: 'update', entityType: 'issue', entityId: req.params.id, newValue: record.toJSON(),
    });
    return ApiResponse.success(res, record, 'Converted to a change request');
  }),

  assigneeCandidates: asyncHandler(async (req, res) => {
    const candidates = await service.assigneeCandidates();
    return ApiResponse.success(res, candidates);
  }),
};

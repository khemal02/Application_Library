const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const { logAction } = require('../../utils/auditLogger');
const service = require('./applicationTracking.service');

// Hand-written throughout, not built on createCrudController — there is no create or remove
// endpoint (1c), and update()/updateStage() both carry authorization and side effects the generic
// factory has no notion of. Each mutating action logs its own audit entry, same shape
// changeRequests.controller.js already uses for its own hand-written actions.
module.exports = {
  list: asyncHandler(async (req, res) => {
    const { items, pagination } = await service.list(req.query);
    return ApiResponse.paginated(res, items, pagination);
  }),

  getById: asyncHandler(async (req, res) => {
    const record = await service.getById(req.params.id);
    return ApiResponse.success(res, record);
  }),

  update: asyncHandler(async (req, res) => {
    const record = await service.update(req.params.id, req.body, req);
    await logAction({
      req, action: 'update', entityType: 'application_track', entityId: req.params.id, newValue: record.toJSON(),
    });
    return ApiResponse.success(res, record, 'Track updated');
  }),

  updateStage: asyncHandler(async (req, res) => {
    const { id, stage } = req.params;
    const record = await service.updateStage(id, stage, req.body, req);
    await logAction({
      req, action: 'update', entityType: 'application_track', entityId: id, newValue: record.toJSON(),
    });
    return ApiResponse.success(res, record, 'Stage updated');
  }),

  goLive: asyncHandler(async (req, res) => {
    const record = await service.goLive(req.params.id, req);
    await logAction({
      req, action: 'update', entityType: 'application_track', entityId: req.params.id, newValue: { status: 'live', applicationId: record.application?.id },
    });
    return ApiResponse.success(res, record, 'Application registered — this track is now live');
  }),

  assignStages: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { record, changes } = await service.assignStages(id, req.body, req);
    await Promise.all(changes.map((c) => logAction({
      req,
      action: 'update',
      entityType: 'application_track',
      entityId: id,
      oldValue: { stage: c.stage, assigneeId: c.previousAssigneeId },
      newValue: { stage: c.stage, assigneeId: c.newAssigneeId },
    })));
    return ApiResponse.success(res, record, 'Assignments updated');
  }),

  hold: asyncHandler(async (req, res) => {
    const record = await service.hold(req.params.id, req.body, req);
    await logAction({
      req, action: 'update', entityType: 'application_track', entityId: req.params.id, newValue: { status: 'on_hold', reason: req.body.reason },
    });
    return ApiResponse.success(res, record, 'Track put on hold');
  }),

  resume: asyncHandler(async (req, res) => {
    const record = await service.resume(req.params.id, req);
    await logAction({
      req, action: 'update', entityType: 'application_track', entityId: req.params.id, newValue: { status: 'active' },
    });
    return ApiResponse.success(res, record, 'Track resumed');
  }),

  cancel: asyncHandler(async (req, res) => {
    const record = await service.cancel(req.params.id, req.body, req);
    await logAction({
      req, action: 'update', entityType: 'application_track', entityId: req.params.id, newValue: { status: 'cancelled', reason: req.body.reason },
    });
    return ApiResponse.success(res, record, 'Track cancelled');
  }),

  assigneeCandidates: asyncHandler(async (req, res) => {
    const candidates = await service.assigneeCandidates();
    return ApiResponse.success(res, candidates);
  }),
};

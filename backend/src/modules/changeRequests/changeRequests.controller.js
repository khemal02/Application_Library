const { createCrudController } = require('../../utils/controllerFactory');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const { logAction } = require('../../utils/auditLogger');
const service = require('./changeRequests.service');

module.exports = {
  ...createCrudController(service, { entityName: 'Change request', entityType: 'change_request' }),

  // Hand-written — not part of the generic CRUD surface, so it logs its own audit entry the way
  // controllerFactory's update() does automatically for everything else.
  updateStage: asyncHandler(async (req, res) => {
    const { applicationId, id, stage } = req.params;
    const record = await service.updateStage(applicationId, id, stage, req.body, req);
    await logAction({
      req, action: 'update', entityType: 'change_request', entityId: id, newValue: record.toJSON(),
    });
    return ApiResponse.success(res, record, 'Stage updated');
  }),

  assigneeCandidates: asyncHandler(async (req, res) => {
    const candidates = await service.assigneeCandidates();
    return ApiResponse.success(res, candidates);
  }),

  // One audit log entry PER CHANGED STAGE, not one for the whole call — `changes` names exactly
  // which stages the service actually wrote (a key present in the body but equal to the current
  // value isn't a change and gets no entry).
  bulkAssignStages: asyncHandler(async (req, res) => {
    const { applicationId, id } = req.params;
    const { record, changes } = await service.bulkAssignStages(applicationId, id, req.body, req);
    await Promise.all(changes.map((c) => logAction({
      req,
      action: 'update',
      entityType: 'change_request',
      entityId: id,
      oldValue: { stage: c.stage, assigneeId: c.previousAssigneeId },
      newValue: { stage: c.stage, assigneeId: c.newAssigneeId },
    })));
    return ApiResponse.success(res, record, 'Assignments updated');
  }),

  // GET /change-requests/my-stages?stage=development — top-level, not under one application; see
  // changeRequests.service.js#myAssignedStages for why.
  myAssignedStages: asyncHandler(async (req, res) => {
    const rows = await service.myAssignedStages(req.user.id, req.query.stage);
    return ApiResponse.success(res, rows);
  }),
};

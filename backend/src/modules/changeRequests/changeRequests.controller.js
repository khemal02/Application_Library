const { createCrudController } = require('../../utils/controllerFactory');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./changeRequests.service');

module.exports = {
  ...createCrudController(service, { entityName: 'Change request' }),

  // Overrides the factory's generated getById, which calls service.getById(req.params.id) with no
  // req — this module's getById needs req to redact an unassigned stage's dates/document link for
  // a viewer who isn't the application's owner/that stage's assignee/a super-admin.
  getById: asyncHandler(async (req, res) => {
    const record = await service.getById(req.params.id, req);
    return ApiResponse.success(res, record);
  }),

  updateStage: asyncHandler(async (req, res) => {
    const { applicationId, id, stage } = req.params;
    const record = await service.updateStage(applicationId, id, stage, req.body, req);
    return ApiResponse.success(res, record, 'Stage updated');
  }),

  advanceStage: asyncHandler(async (req, res) => {
    const { applicationId, id, stage } = req.params;
    const record = await service.advanceStage(applicationId, id, stage, req.body, req);
    return ApiResponse.success(res, record, 'Moved to the next stage');
  }),

  sendBackStage: asyncHandler(async (req, res) => {
    const { applicationId, id, stage } = req.params;
    const record = await service.sendBackStage(applicationId, id, stage, req.body.reason, req);
    return ApiResponse.success(res, record, 'Sent back to the previous stage');
  }),

  implement: asyncHandler(async (req, res) => {
    const { applicationId, id } = req.params;
    const record = await service.implement(applicationId, id, req);
    return ApiResponse.success(res, record, 'Change request marked implemented');
  }),

  statusHistory: asyncHandler(async (req, res) => {
    const history = await service.statusHistory(req.params.id);
    return ApiResponse.success(res, history);
  }),

  assigneeCandidates: asyncHandler(async (req, res) => {
    const candidates = await service.assigneeCandidates();
    return ApiResponse.success(res, candidates);
  }),

  bulkAssignStages: asyncHandler(async (req, res) => {
    const { applicationId, id } = req.params;
    const { record } = await service.bulkAssignStages(applicationId, id, req.body, req);
    return ApiResponse.success(res, record, 'Assignments updated');
  }),

  // GET /change-requests/my-stages?stage=development — top-level, not under one application; see
  // changeRequests.service.js#myAssignedStages for why.
  myAssignedStages: asyncHandler(async (req, res) => {
    const rows = await service.myAssignedStages(req.user.id, req.query.stage);
    return ApiResponse.success(res, rows);
  }),
};

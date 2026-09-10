const { createCrudController } = require('../../utils/controllerFactory');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./changeRequests.service');

module.exports = {
  ...createCrudController(service, { entityName: 'Change request' }),

  updateStage: asyncHandler(async (req, res) => {
    const { applicationId, id, stage } = req.params;
    const record = await service.updateStage(applicationId, id, stage, req.body, req);
    return ApiResponse.success(res, record, 'Stage updated');
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

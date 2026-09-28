const { createCrudController } = require('../../utils/controllerFactory');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./changeRequests.service');
// Imported here, not in changeRequests.service.js itself — applicationTracking.service.js already
// imports changeRequests.service.js (reuses its assigneeCandidates()), so importing it back the
// other way from there would be a circular service-to-service require. The controller layer sits
// above both, so merging their two result sets here is safe.
const applicationTrackingService = require('../applicationTracking/applicationTracking.service');

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
  // changeRequests.service.js#myAssignedStages for why. Merges in the idea-track half too (see
  // applicationTrackingService.myAssignedStages's own docstring) — a Dashboard tile's count
  // (dashboard.service.js#getSummary) already covers both, so the list it links into must show
  // both as well, not just the change-request slice of it.
  myAssignedStages: asyncHandler(async (req, res) => {
    const [changeRequestRows, trackRows] = await Promise.all([
      service.myAssignedStages(req.user.id, req.query.stage),
      applicationTrackingService.myAssignedStages(req.user.id, req.query.stage),
    ]);
    const rows = [...changeRequestRows, ...trackRows].sort((a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0));
    return ApiResponse.success(res, rows);
  }),
};

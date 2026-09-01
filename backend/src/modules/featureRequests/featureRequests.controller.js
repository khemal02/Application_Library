const { createCrudController } = require('../../utils/controllerFactory');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const { logAction } = require('../../utils/auditLogger');
const service = require('./featureRequests.service');

const controller = createCrudController(service, { entityName: 'Feature request', entityType: 'feature_request' });

controller.list = asyncHandler(async (req, res) => {
  const { items, pagination } = await service.list(req.query, req);
  return ApiResponse.paginated(res, items, pagination);
});

controller.getById = asyncHandler(async (req, res) => {
  const record = await service.getById(req.params.id, req);
  return ApiResponse.success(res, record);
});

// service.create() returns getById's enriched plain object, not a raw Sequelize instance — no
// toJSON() to call. `panel` is stripped before logging (viewer-dependent, always empty at
// creation anyway) — same reasoning as ideas.controller.js#create.
controller.create = asyncHandler(async (req, res) => {
  const record = await service.create(req.body, req);
  const { panel, ...auditable } = record;
  await logAction({ req, action: 'create', entityType: 'feature_request', entityId: record.id, newValue: auditable });
  return ApiResponse.created(res, record, 'Feature request created');
});

controller.submitReview = asyncHandler(async (req, res) => {
  const record = await service.submitReview(req.params.id, req.body, req);
  await logAction({
    req, action: 'update', entityType: 'feature_request', entityId: record.id,
    newValue: { panelVote: req.body, status: record.status },
  });
  return ApiResponse.success(res, record, 'Review submitted');
});

controller.addParticipants = asyncHandler(async (req, res) => {
  const record = await service.addParticipants(req.params.id, req.body, req);
  await logAction({
    req, action: 'update', entityType: 'feature_request', entityId: record.id, newValue: { panelAdd: req.body },
  });
  return ApiResponse.success(res, record, 'Added to panel');
});

controller.removeParticipant = asyncHandler(async (req, res) => {
  const record = await service.removeParticipant(req.params.id, req.params.userId, req);
  await logAction({
    req, action: 'update', entityType: 'feature_request', entityId: record.id,
    newValue: { panelRemove: req.params.userId },
  });
  return ApiResponse.success(res, record, 'Removed from panel');
});

controller.panelCandidates = asyncHandler(async (req, res) => {
  const users = await service.panelCandidates(req.params.id, req.query.kind, req);
  return ApiResponse.success(res, users);
});

controller.statusHistory = asyncHandler(async (req, res) => {
  const history = await service.statusHistory(req.params.id);
  return ApiResponse.success(res, history);
});

controller.analytics = asyncHandler(async (req, res) => {
  const data = await service.analytics();
  return ApiResponse.success(res, data);
});

module.exports = controller;

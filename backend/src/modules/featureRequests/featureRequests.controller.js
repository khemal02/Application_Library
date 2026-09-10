const { createCrudController } = require('../../utils/controllerFactory');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./featureRequests.service');

const controller = createCrudController(service, { entityName: 'Feature request' });

controller.list = asyncHandler(async (req, res) => {
  const { items, pagination } = await service.list(req.query, req);
  return ApiResponse.paginated(res, items, pagination);
});

controller.getById = asyncHandler(async (req, res) => {
  const record = await service.getById(req.params.id, req);
  return ApiResponse.success(res, record);
});

controller.create = asyncHandler(async (req, res) => {
  const record = await service.create(req.body, req);
  return ApiResponse.created(res, record, 'Feature request created');
});

controller.submitReview = asyncHandler(async (req, res) => {
  const record = await service.submitReview(req.params.id, req.body, req);
  return ApiResponse.success(res, record, 'Review submitted');
});

controller.addParticipants = asyncHandler(async (req, res) => {
  const record = await service.addParticipants(req.params.id, req.body, req);
  return ApiResponse.success(res, record, 'Added to panel');
});

controller.removeParticipant = asyncHandler(async (req, res) => {
  const record = await service.removeParticipant(req.params.id, req.params.userId, req);
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

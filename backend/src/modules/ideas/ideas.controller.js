const { createCrudController } = require('../../utils/controllerFactory');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./ideas.service');

const controller = createCrudController(service, { entityName: 'Idea' });

// Overrides the factory's generated list, which calls service.list(req.query) with no req — this
// module's list needs req.user to resolve awaitingMyReview=true. Does not touch
// controllerFactory.js; every other module keeps the factory version.
controller.list = asyncHandler(async (req, res) => {
  const { items, pagination } = await service.list(req.query, req);
  return ApiResponse.paginated(res, items, pagination);
});

// Overrides the factory's generated getById, which calls service.getById(req.params.id) with no
// req — this module's getById needs req to compute availableTransitions/stageOwnerRoles for the
// requesting user. Does not touch controllerFactory.js; every other module keeps the factory version.
controller.getById = asyncHandler(async (req, res) => {
  const idea = await service.getById(req.params.id, req);
  return ApiResponse.success(res, idea);
});

controller.create = asyncHandler(async (req, res) => {
  const idea = await service.create(req.body, req);
  return ApiResponse.created(res, idea, 'Idea created');
});

// Handles every panel member's own verdict — reviewer or approver — through this one endpoint;
// there is no separate /decision route.
controller.submitReview = asyncHandler(async (req, res) => {
  const idea = await service.submitReview(req.params.id, req.body, req);
  return ApiResponse.success(res, idea, 'Review submitted');
});

// R6: adding participants is always allowed while the idea is live. R3/R4/R7/R8 are all enforced
// in the service (ideas.service.js#addParticipants).
controller.addParticipants = asyncHandler(async (req, res) => {
  const idea = await service.addParticipants(req.params.id, req.body, req);
  return ApiResponse.success(res, idea, 'Added to panel');
});

controller.removeParticipant = asyncHandler(async (req, res) => {
  const idea = await service.removeParticipant(req.params.id, req.params.userId, req);
  return ApiResponse.success(res, idea, 'Removed from panel');
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

controller.eligibleOwners = asyncHandler(async (req, res) => {
  const users = await service.eligibleOwners();
  return ApiResponse.success(res, users);
});

module.exports = controller;

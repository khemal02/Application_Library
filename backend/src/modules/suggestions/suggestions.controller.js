const { createCrudController } = require('../../utils/controllerFactory');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const { logAction } = require('../../utils/auditLogger');
const service = require('./suggestions.service');

const controller = createCrudController(service, { entityName: 'Suggestion', entityType: 'suggestion' });

// Overrides the factory's generated list, which calls service.list(req.query) with no req — this
// module's list needs req.user to resolve awaitingMyReview=true. Mirrors ideas.controller.js.
controller.list = asyncHandler(async (req, res) => {
  const { items, pagination } = await service.list(req.query, req);
  return ApiResponse.paginated(res, items, pagination);
});

// Overrides the factory's generated getById, which calls service.getById(req.params.id) with no
// req — this module's getById needs req to compute availableTransitions/stageOwnerRoles/reviewPanel.
controller.getById = asyncHandler(async (req, res) => {
  const suggestion = await service.getById(req.params.id, req);
  return ApiResponse.success(res, suggestion);
});

// Overrides the factory's generated create, which calls record.toJSON() for the audit log.
// service.create() now returns getById's enriched plain object, which has no toJSON() to call —
// pass it straight through instead, stripping the per-viewer computed fields first (same reasoning
// as ideas.controller.js's create override).
controller.create = asyncHandler(async (req, res) => {
  const suggestion = await service.create(req.body, req);
  const { availableTransitions, stageOwnerRoles, ...auditable } = suggestion;
  await logAction({ req, action: 'create', entityType: 'suggestion', entityId: suggestion.id, newValue: auditable });
  return ApiResponse.created(res, suggestion, 'Suggestion created');
});

controller.transition = asyncHandler(async (req, res) => {
  const suggestion = await service.transition(req.params.id, req.body, req);
  await logAction({ req, action: 'update', entityType: 'suggestion', entityId: suggestion.id, newValue: { title: suggestion.title, status: suggestion.status } });
  return ApiResponse.success(res, suggestion, 'Suggestion status updated');
});

controller.submitReview = asyncHandler(async (req, res) => {
  const suggestion = await service.submitReview(req.params.id, req.body, req);
  await logAction({
    req, action: 'update', entityType: 'suggestion', entityId: suggestion.id, newValue: { panelVote: req.body },
  });
  return ApiResponse.success(res, suggestion, 'Review submitted');
});

controller.submitDecision = asyncHandler(async (req, res) => {
  const suggestion = await service.submitDecision(req.params.id, req.body, req);
  await logAction({
    req, action: 'update', entityType: 'suggestion', entityId: suggestion.id, newValue: { panelDecision: req.body, status: suggestion.status },
  });
  return ApiResponse.success(res, suggestion, 'Decision recorded');
});

controller.eligibleReviewers = asyncHandler(async (req, res) => {
  const result = await service.eligibleReviewersForSuggestion(req.params.id);
  return ApiResponse.success(res, result);
});

controller.statusHistory = asyncHandler(async (req, res) => {
  const history = await service.statusHistory(req.params.id);
  return ApiResponse.success(res, history);
});

module.exports = controller;

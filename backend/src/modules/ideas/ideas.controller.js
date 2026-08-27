const { createCrudController } = require('../../utils/controllerFactory');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const { logAction } = require('../../utils/auditLogger');
const service = require('./ideas.service');

const controller = createCrudController(service, { entityName: 'Idea', entityType: 'idea' });

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

// Overrides the factory's generated create, which calls record.toJSON() for the audit log.
// service.create() now returns getById's enriched plain object rather than a raw Sequelize
// instance, so it has no toJSON() to call — pass it straight through instead. `panel` is stripped
// before logging: it's viewer-dependent (myRow/canManagePanel depend on who's asking, right now),
// so leaving it in would make the same idea at the same status log a different snapshot depending
// on who acted — a phantom diff for anyone comparing audit rows over time. It's also always empty
// at creation anyway (the panel starts with nobody on it), so there's nothing worth keeping here.
controller.create = asyncHandler(async (req, res) => {
  const idea = await service.create(req.body, req);
  const { panel, ...auditable } = idea;
  await logAction({ req, action: 'create', entityType: 'idea', entityId: idea.id, newValue: auditable });
  return ApiResponse.created(res, idea, 'Idea created');
});

// Handles every panel member's own verdict — reviewer or approver — through this one endpoint;
// there is no separate /decision route.
controller.submitReview = asyncHandler(async (req, res) => {
  const idea = await service.submitReview(req.params.id, req.body, req);
  await logAction({
    req, action: 'update', entityType: 'idea', entityId: idea.id,
    newValue: { panelVote: req.body, status: idea.status },
  });
  return ApiResponse.success(res, idea, 'Review submitted');
});

// R6: adding participants is always allowed while the idea is live, and is logged — this is that
// log. R3/R4/R7/R8 are all enforced in the service (ideas.service.js#addParticipants).
controller.addParticipants = asyncHandler(async (req, res) => {
  const idea = await service.addParticipants(req.params.id, req.body, req);
  await logAction({
    req, action: 'update', entityType: 'idea', entityId: idea.id, newValue: { panelAdd: req.body },
  });
  return ApiResponse.success(res, idea, 'Added to panel');
});

// R6: removing an unresponded participant is logged too.
controller.removeParticipant = asyncHandler(async (req, res) => {
  const idea = await service.removeParticipant(req.params.id, req.params.userId, req);
  await logAction({
    req, action: 'update', entityType: 'idea', entityId: idea.id,
    newValue: { panelRemove: req.params.userId },
  });
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

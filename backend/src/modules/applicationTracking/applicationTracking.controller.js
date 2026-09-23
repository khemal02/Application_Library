const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./applicationTracking.service');

// Hand-written throughout, not built on createCrudController — there is no create or remove
// endpoint (1c), and update()/updateStage() both carry authorization and side effects the generic
// factory has no notion of.
module.exports = {
  list: asyncHandler(async (req, res) => {
    const { items, pagination } = await service.list(req.query, req);
    return ApiResponse.paginated(res, items, pagination);
  }),

  getById: asyncHandler(async (req, res) => {
    const record = await service.getById(req.params.id, req);
    return ApiResponse.success(res, record);
  }),

  update: asyncHandler(async (req, res) => {
    const record = await service.update(req.params.id, req.body, req);
    return ApiResponse.success(res, record, 'Track updated');
  }),

  updateStage: asyncHandler(async (req, res) => {
    const { id, stage } = req.params;
    const record = await service.updateStage(id, stage, req.body, req);
    return ApiResponse.success(res, record, 'Stage updated');
  }),

  advanceStage: asyncHandler(async (req, res) => {
    const { id, stage } = req.params;
    const record = await service.advanceStage(id, stage, req.body, req);
    return ApiResponse.success(res, record, 'Moved to the next stage');
  }),

  sendBackStage: asyncHandler(async (req, res) => {
    const { id, stage } = req.params;
    const record = await service.sendBackStage(id, stage, req.body.reason, req);
    return ApiResponse.success(res, record, 'Sent back to the previous stage');
  }),

  statusHistory: asyncHandler(async (req, res) => {
    const history = await service.statusHistory(req.params.id);
    return ApiResponse.success(res, history);
  }),

  reorder: asyncHandler(async (req, res) => {
    const record = await service.reorder(req.params.id, req.body, req);
    return ApiResponse.success(res, record, 'Reordered');
  }),

  getQueue: asyncHandler(async (req, res) => {
    const queue = await service.getQueue(req);
    return ApiResponse.success(res, queue);
  }),

  reorderQueue: asyncHandler(async (req, res) => {
    const queue = await service.reorderQueueItem(req.body, req);
    return ApiResponse.success(res, queue, 'Reordered');
  }),

  goLive: asyncHandler(async (req, res) => {
    const record = await service.goLive(req.params.id, req);
    return ApiResponse.success(res, record, 'Application registered — this track is now live');
  }),

  assignStages: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { record } = await service.assignStages(id, req.body, req);
    return ApiResponse.success(res, record, 'Assignments updated');
  }),

  hold: asyncHandler(async (req, res) => {
    const record = await service.hold(req.params.id, req.body, req);
    return ApiResponse.success(res, record, 'Track put on hold');
  }),

  resume: asyncHandler(async (req, res) => {
    const record = await service.resume(req.params.id, req);
    return ApiResponse.success(res, record, 'Track resumed');
  }),

  cancel: asyncHandler(async (req, res) => {
    const record = await service.cancel(req.params.id, req.body, req);
    return ApiResponse.success(res, record, 'Track cancelled');
  }),

  assigneeCandidates: asyncHandler(async (req, res) => {
    const candidates = await service.assigneeCandidates();
    return ApiResponse.success(res, candidates);
  }),
};

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
};

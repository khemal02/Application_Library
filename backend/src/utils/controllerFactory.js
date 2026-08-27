const asyncHandler = require('./asyncHandler');
const ApiResponse = require('./ApiResponse');
const { logAction } = require('./auditLogger');

/**
 * Wraps a service exposing {list, getById, create, update, remove} into Express handlers.
 * Every mutating action is written to the audit trail automatically (entityType comes from the
 * module); `hooks` lets a module layer additional side effects (notifications, etc.) on top.
 */
function createCrudController(service, { entityName = 'Resource', entityType, hooks = {} } = {}) {
  return {
    list: asyncHandler(async (req, res) => {
      const { items, pagination } = await service.list(req.query);
      return ApiResponse.paginated(res, items, pagination);
    }),

    getById: asyncHandler(async (req, res) => {
      const record = await service.getById(req.params.id);
      return ApiResponse.success(res, record);
    }),

    create: asyncHandler(async (req, res) => {
      const record = await service.create(req.body, req);
      await logAction({ req, action: 'create', entityType, entityId: record.id, newValue: record.toJSON() });
      if (hooks.afterCreate) await hooks.afterCreate(record, req);
      return ApiResponse.created(res, record, `${entityName} created`);
    }),

    update: asyncHandler(async (req, res) => {
      const before = await (service.getRawById || service.getById)(req.params.id).catch(() => null);
      const record = await service.update(req.params.id, req.body, req);
      await logAction({
        req, action: 'update', entityType, entityId: record.id,
        oldValue: before ? before.toJSON() : null, newValue: record.toJSON(),
      });
      if (hooks.afterUpdate) await hooks.afterUpdate(record, before, req);
      return ApiResponse.success(res, record, `${entityName} updated`);
    }),

    remove: asyncHandler(async (req, res) => {
      const before = await (service.getRawById || service.getById)(req.params.id).catch(() => null);
      await service.remove(req.params.id, req);
      await logAction({
        req, action: 'delete', entityType, entityId: req.params.id,
        oldValue: before ? before.toJSON() : null,
      });
      if (hooks.afterRemove) await hooks.afterRemove(before, req);
      return ApiResponse.noContent(res);
    }),
  };
}

module.exports = { createCrudController };

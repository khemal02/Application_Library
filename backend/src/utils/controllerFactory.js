const asyncHandler = require('./asyncHandler');
const ApiResponse = require('./ApiResponse');

/**
 * Wraps a service exposing {list, getById, create, update, remove} into Express handlers.
 * `hooks` lets a module layer additional side effects (notifications, etc.) on top.
 */
function createCrudController(service, { entityName = 'Resource', hooks = {} } = {}) {
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
      if (hooks.afterCreate) await hooks.afterCreate(record, req);
      return ApiResponse.created(res, record, `${entityName} created`);
    }),

    update: asyncHandler(async (req, res) => {
      const before = hooks.afterUpdate
        ? await (service.getRawById || service.getById)(req.params.id).catch(() => null)
        : null;
      const record = await service.update(req.params.id, req.body, req);
      if (hooks.afterUpdate) await hooks.afterUpdate(record, before, req);
      return ApiResponse.success(res, record, `${entityName} updated`);
    }),

    remove: asyncHandler(async (req, res) => {
      const before = hooks.afterRemove
        ? await (service.getRawById || service.getById)(req.params.id).catch(() => null)
        : null;
      await service.remove(req.params.id, req);
      if (hooks.afterRemove) await hooks.afterRemove(before, req);
      return ApiResponse.noContent(res);
    }),
  };
}

module.exports = { createCrudController };

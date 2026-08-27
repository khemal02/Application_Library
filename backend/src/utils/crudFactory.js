const ApiError = require('./ApiError');
const { buildQueryOptions, buildPaginationMeta } = require('./paginate');

/**
 * Generic repository-style service for straightforward CRUD sub-resources (tech stack entries,
 * features, AI prompts, architecture docs, roadmap items, etc). Domains with real business logic
 * (applications, ideas, suggestions, auth) compose this factory and layer workflow/notification/
 * audit behaviour on top rather than reimplementing list/get/create/update/remove from scratch.
 */
function createCrudService(Model, {
  searchableFields = [],
  filterableFields = [],
  defaultSort = [['createdAt', 'DESC']],
  include = [],
  notFoundMessage = 'Resource not found',
} = {}) {
  return {
    async list(query) {
      const { where, order, limit, offset, page } = buildQueryOptions(query, {
        searchableFields,
        filterableFields,
        defaultSort,
      });
      const { rows, count } = await Model.findAndCountAll({
        where, order, limit, offset, include, distinct: true,
      });
      return { items: rows, pagination: buildPaginationMeta({ page, limit, count }) };
    },

    async getById(id) {
      const record = await Model.findByPk(id, { include });
      if (!record) throw ApiError.notFound(notFoundMessage);
      return record;
    },

    // Bare fetch with none of `getById`'s (possibly heavy, e.g. applications' 11-table) include
    // set. Used by controllerFactory purely to snapshot "before" state for the audit log on
    // update/remove — that snapshot never needs the nested detail-view associations. Services
    // that spread this factory (`{ ...base, ... }`) get it for free without overriding it.
    async getRawById(id) {
      const record = await Model.findByPk(id);
      if (!record) throw ApiError.notFound(notFoundMessage);
      return record;
    },

    async create(payload) {
      return Model.create(payload);
    },

    async update(id, payload) {
      const record = await Model.findByPk(id);
      if (!record) throw ApiError.notFound(notFoundMessage);
      await record.update(payload);
      return record;
    },

    async remove(id) {
      const record = await Model.findByPk(id);
      if (!record) throw ApiError.notFound(notFoundMessage);
      await record.destroy();
      return record;
    },
  };
}

module.exports = { createCrudService };

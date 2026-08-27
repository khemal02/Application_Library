const { Op } = require('sequelize');

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

/**
 * Builds Sequelize find options (where/order/limit/offset) from a request query string,
 * following the pagination/sort/filter/search conventions used across every list endpoint:
 *   ?page=1&limit=20&sort=-createdAt&search=foo&status=approved&status=rejected
 *
 * - `search` does a case-insensitive partial match across `searchableFields`.
 * - Any query key listed in `filterableFields` becomes an exact-match (or IN, if repeated /
 *   comma-separated) filter.
 * - `sort` is a comma separated list of fields, prefixed with `-` for DESC (default ASC).
 */
function buildQueryOptions(query = {}, { searchableFields = [], filterableFields = [], defaultSort = [['createdAt', 'DESC']] } = {}) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = (page - 1) * limit;

  const andConditions = [];

  if (query.search && searchableFields.length) {
    andConditions.push({
      [Op.or]: searchableFields.map((field) => ({ [field]: { [Op.iLike]: `%${query.search}%` } })),
    });
  }

  filterableFields.forEach((field) => {
    const raw = query[field];
    if (raw === undefined || raw === null || raw === '') return;
    const values = Array.isArray(raw) ? raw : String(raw).split(',');
    andConditions.push({ [field]: values.length > 1 ? { [Op.in]: values } : values[0] });
  });

  const where = andConditions.length ? { [Op.and]: andConditions } : {};

  let order = defaultSort;
  if (query.sort) {
    order = String(query.sort)
      .split(',')
      .map((token) => {
        const desc = token.startsWith('-');
        const field = desc ? token.slice(1) : token;
        return [field, desc ? 'DESC' : 'ASC'];
      });
  }

  return { where, order, limit, offset, page };
}

function buildPaginationMeta({ page, limit, count }) {
  return {
    page,
    limit,
    totalItems: count,
    totalPages: Math.max(Math.ceil(count / limit), 1),
  };
}

module.exports = { buildQueryOptions, buildPaginationMeta, MAX_LIMIT, DEFAULT_LIMIT };

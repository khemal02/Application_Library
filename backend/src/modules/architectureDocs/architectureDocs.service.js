const { ArchitectureDoc } = require('../../models');
const { buildQueryOptions, buildPaginationMeta } = require('../../utils/paginate');
const ApiError = require('../../utils/ApiError');

async function list(query) {
  const { where, order, limit, offset, page } = buildQueryOptions(query, {
    filterableFields: ['applicationId', 'docType'],
    defaultSort: [['docType', 'ASC']],
  });
  const { rows, count } = await ArchitectureDoc.findAndCountAll({ where, order, limit, offset });
  return { items: rows, pagination: buildPaginationMeta({ page, limit, count }) };
}

async function getById(id) {
  const record = await ArchitectureDoc.findByPk(id);
  if (!record) throw ApiError.notFound('Architecture doc not found');
  return record;
}

async function upsert(payload, req) {
  const { applicationId, docType } = payload;
  const [doc] = await ArchitectureDoc.findOrCreate({
    where: { applicationId, docType },
    defaults: { ...payload, updatedBy: req?.user?.id },
  });
  await doc.update({ ...payload, updatedBy: req?.user?.id });
  return doc;
}

async function remove(id) {
  const record = await getById(id);
  await record.destroy();
  return record;
}

module.exports = { list, getById, upsert, remove };

const { createCrudService } = require('../../utils/crudFactory');
const { ReleaseNote } = require('../../models');

const base = createCrudService(ReleaseNote, {
  filterableFields: ['applicationId'],
  defaultSort: [['releaseDate', 'DESC']],
  notFoundMessage: 'Release note not found',
});

async function create(payload, req) {
  return ReleaseNote.create({ ...payload, createdBy: req?.user?.id });
}

module.exports = { ...base, create };

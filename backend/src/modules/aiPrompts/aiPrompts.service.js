const { createCrudService } = require('../../utils/crudFactory');
const { AiPrompt, User } = require('../../models');

const base = createCrudService(AiPrompt, {
  searchableFields: ['title', 'promptText', 'outputSummary'],
  filterableFields: ['applicationId', 'promptType', 'aiModel', 'createdBy'],
  include: [{ model: User, as: 'author', attributes: ['id', 'name', 'avatarUrl'] }],
  notFoundMessage: 'AI prompt not found',
});

async function create(payload, req) {
  return AiPrompt.create({ ...payload, createdBy: req?.user?.id });
}

module.exports = { ...base, create };

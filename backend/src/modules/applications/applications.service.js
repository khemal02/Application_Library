const { createCrudService } = require('../../utils/crudFactory');
const {
  Application, User, Department, ApplicationTechStack, ApplicationFeature,
  AiPrompt, ArchitectureDoc, ApiEndpoint, DbTableDoc, ReleaseNote, BugHistory,
  KnownIssue, RoadmapItem, TimelineMilestone, sequelize,
} = require('../../models');
const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');
const { cleanupEntityRefs } = require('../../utils/entityCleanup');
const { getStorageDriver } = require('../attachments/storage');

const listInclude = [
  { model: User, as: 'owner', attributes: ['id', 'name', 'avatarUrl'] },
  { model: Department, as: 'department', attributes: ['id', 'name'] },
];

const detailInclude = [
  ...listInclude,
  { model: ApplicationTechStack, as: 'techStack' },
  { model: ApplicationFeature, as: 'features' },
  { model: AiPrompt, as: 'aiPrompts' },
  { model: ArchitectureDoc, as: 'architectureDocs' },
  { model: ApiEndpoint, as: 'apiEndpoints' },
  { model: DbTableDoc, as: 'dbTableDocs' },
  { model: ReleaseNote, as: 'releaseNotes' },
  { model: BugHistory, as: 'bugs' },
  { model: KnownIssue, as: 'knownIssues' },
  { model: RoadmapItem, as: 'roadmapItems' },
  { model: TimelineMilestone, as: 'timelineMilestones' },
];

const base = createCrudService(Application, {
  searchableFields: ['name', 'description', 'category'],
  filterableFields: ['status', 'priority', 'category', 'ownerId', 'departmentId', 'industry', 'functionalArea'],
  include: listInclude,
  notFoundMessage: 'Application not found',
});

async function getById(id) {
  const record = await Application.findByPk(id, { include: detailInclude });
  if (!record) throw ApiError.notFound('Application not found');
  return record;
}

async function create(payload, req) {
  return Application.create({ ...payload, createdBy: req?.user?.id });
}

/**
 * Overrides base.remove — same reasoning as ideas'/suggestions': crudFactory's generic remove(id)
 * has no way to accept a transaction, and the application's own destroy() must commit together
 * with its polymorphic cleanup (comments + their attachments, votes, tags, status history,
 * notifications) or not at all. Applications have exactly one comment channel (no separate
 * "_note" thread, unlike suggestions), so only 'application' needs cleaning. This does not touch
 * the application's own real sub-resource tables (tech stack, features, bugs, etc.) — those have
 * genuine foreign keys to applications.id, not the polymorphic entityType/entityId pattern this
 * helper exists for, and are out of this fix's scope.
 */
async function remove(id) {
  let filePaths = [];
  const application = await sequelize.transaction(async (transaction) => {
    const record = await Application.findByPk(id, { transaction });
    if (!record) throw ApiError.notFound('Application not found');
    const result = await cleanupEntityRefs('application', id, { transaction });
    filePaths = result.filePaths;
    logger.info('Application deleted — cleaned up dependent rows', { applicationId: id, ...result.counts });
    await record.destroy({ transaction });
    return record;
  });

  for (const filePath of filePaths) {
    try {
      await getStorageDriver().remove(filePath);
    } catch (err) {
      logger.error('Failed to remove attachment file after application deletion', { filePath, error: err.message });
    }
  }

  return application;
}

module.exports = { ...base, getById, create, remove };

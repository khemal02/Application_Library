const { createCrudService } = require('../../utils/crudFactory');
const {
  Application, User, Department, ApplicationTechStack, ApplicationFeature,
  AiPrompt, ArchitectureDoc, ApiEndpoint, DbTableDoc, ReleaseNote, BugHistory,
  RoadmapItem, TimelineMilestone, sequelize,
} = require('../../models');
const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');
const { cleanupEntityRefs, mergeCounts } = require('../../utils/entityCleanup');
const { getStorageDriver } = require('../attachments/storage');
const issuesService = require('../issues/issues.service');

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
  { model: RoadmapItem, as: 'roadmapItems' },
  { model: TimelineMilestone, as: 'timelineMilestones' },
];

const base = createCrudService(Application, {
  searchableFields: ['name', 'description', 'category'],
  filterableFields: ['status', 'category', 'ownerId', 'departmentId', 'industry', 'functionalArea'],
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
 * "_note" thread, unlike suggestions), so only 'application' needs cleaning directly. This does
 * not touch the application's own real sub-resource tables (tech stack, features, bugs, etc.) —
 * those have genuine foreign keys to applications.id and cascade at the DB level.
 *
 * Issues are the one exception that needs help: `issues.application_id` cascades at the DB level
 * (deleting the issue rows themselves), but each issue's own comments/votes are polymorphic
 * (entityType/entityId, no real FK) and would otherwise survive as orphans — see the Issues RICC
 * prompt's V9. issuesService.cleanupForApplication runs first, in the same transaction, and its
 * tally/file list is merged into this function's own.
 */
async function remove(id) {
  let filePaths = [];
  const application = await sequelize.transaction(async (transaction) => {
    const record = await Application.findByPk(id, { transaction });
    if (!record) throw ApiError.notFound('Application not found');
    const issuesCleanup = await issuesService.cleanupForApplication(id, { transaction });
    const result = await cleanupEntityRefs('application', id, { transaction });
    filePaths = [...result.filePaths, ...issuesCleanup.filePaths];
    const counts = mergeCounts(result.counts, issuesCleanup.counts);
    logger.info('Application deleted — cleaned up dependent rows', { applicationId: id, ...counts });
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

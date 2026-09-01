const { Op } = require('sequelize');
const { createCrudService } = require('../../utils/crudFactory');
const { buildQueryOptions, buildPaginationMeta } = require('../../utils/paginate');
const {
  FeatureRequest, User, Role, RolePermission, Department, Application, ChangeRequest, StatusHistory,
  Vote, Comment, FeatureRequestReview, sequelize,
} = require('../../models');
const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');
const { isSuperAdmin } = require('../../utils/permissions');
const { ROLE_LABELS } = require('./featureRequests.constants');
const notificationsService = require('../notifications/notifications.service');
const tagsService = require('../tags/tags.service');
const changeRequestsService = require('../changeRequests/changeRequests.service');
const { cleanupEntityRefs } = require('../../utils/entityCleanup');
const { getStorageDriver } = require('../attachments/storage');

const SEARCHABLE_FIELDS = ['title', 'description', 'businessProblem', 'proposedSolution'];
const FILTERABLE_FIELDS = ['status', 'priority', 'departmentId', 'submittedBy', 'estimatedComplexity', 'applicationId', 'industry', 'functionalArea', 'internalUse'];

const include = [
  { model: User, as: 'submitter', attributes: ['id', 'name', 'avatarUrl'] },
  { model: Department, as: 'department', attributes: ['id', 'name'] },
  { model: Application, as: 'application', attributes: ['id', 'name'] },
  // Set only once approved — see finalizeFeatureRequest() below and
  // changeRequests.service.js#createFromFeatureRequest.
  { model: ChangeRequest, as: 'changeRequest', attributes: ['id', 'applicationId'] },
];

const base = createCrudService(FeatureRequest, {
  searchableFields: SEARCHABLE_FIELDS,
  filterableFields: FILTERABLE_FIELDS,
  include,
  notFoundMessage: 'Feature request not found',
});

// Forked from ideas.service.js as part of the Ideas/Feature-Requests split (see the project
// report and 20260130000035). Everything below — the open panel, majority-vote approval, tie
// break — is identical in RULE to Ideas' own; it's a separate copy (not a shared utility) by
// explicit instruction, so a future rule change here does NOT need to also touch ideas.service.js
// or vice versa. The one thing this module has that Ideas doesn't: every approval raises a
// change request against the target application (see finalizeFeatureRequest).

async function create(payload, req) {
  const { tags, ...rest } = payload;
  // Always inherits department/industry/functionalArea from the target Application — a feature
  // request is FOR that application, so its domain/org-chart placement should reflect the app's,
  // not whatever the requester happens to guess. department falls back to the submitter's own
  // only if the application itself has none; industry/functionalArea have no such fallback.
  const targetApp = await Application.findByPk(rest.applicationId, {
    attributes: ['id', 'name', 'departmentId', 'industry', 'functionalArea'],
  });
  let { departmentId, industry, functionalArea } = rest;
  if (departmentId == null) departmentId = targetApp?.departmentId ?? req.user.departmentId;
  if (!industry) industry = targetApp?.industry ?? null;
  if (!functionalArea) functionalArea = targetApp?.functionalArea ?? null;

  const featureRequest = await FeatureRequest.create({
    ...rest, departmentId, industry, functionalArea, submittedBy: req.user.id,
  });
  if (tags?.length) await tagsService.setForEntity('feature_request', featureRequest.id, tags);

  // Company-wide broadcast, same as Ideas' own — discussion is meant to be visible to everyone,
  // not just whoever happens to own the target application's functional area. The submitter
  // doesn't notify themselves. Failure here must never break creation — logged and swallowed.
  try {
    const allUsers = await User.findAll({
      where: { status: 'active', id: { [Op.ne]: req.user.id } },
      attributes: ['id'],
    });
    const recipients = allUsers.map((u) => ({
      userId: u.id,
      type: 'feature_request_submitted',
      title: 'A feature request is open for discussion',
      message: `"${featureRequest.title}" — a feature request for "${targetApp?.name || 'an application'}" — is open for discussion.`,
      link: `/feature-requests/${featureRequest.id}`,
    }));
    if (recipients.length > 0) await notificationsService.createMany(recipients);
  } catch (err) {
    logger.error('Failed to create feature-request-submitted notifications', {
      featureRequestId: featureRequest.id, error: { message: err.message, stack: err.stack },
    });
  }

  return getById(featureRequest.id, req);
}

/** Overrides base.update — same freeze-once-decided rule as Ideas. */
async function update(id, payload) {
  const record = await FeatureRequest.findByPk(id, { attributes: ['id', 'status'] });
  if (!record) throw ApiError.notFound('Feature request not found');
  if (record.status === 'approved' || record.status === 'rejected') {
    throw ApiError.badRequest('This feature request has been decided — it can no longer be edited.');
  }
  return base.update(id, payload);
}

/**
 * Overrides base.remove — same reasoning as ideas.service.js#remove: a decided record can't be
 * deleted (no super-admin bypass), and the delete + polymorphic cleanup must commit together.
 * feature_request_reviews cascades on its own (real FK, ON DELETE CASCADE).
 */
async function remove(id) {
  let filePaths = [];
  const record = await sequelize.transaction(async (transaction) => {
    const fr = await FeatureRequest.findByPk(id, { transaction });
    if (!fr) throw ApiError.notFound('Feature request not found');
    if (fr.status === 'approved' || fr.status === 'rejected') {
      throw ApiError.badRequest('This feature request has been decided — it can no longer be deleted.');
    }
    const cleanup = await cleanupEntityRefs('feature_request', id, { transaction });
    filePaths = cleanup.filePaths;
    logger.info('Feature request deleted — cleaned up dependent rows', { featureRequestId: id, ...cleanup.counts });
    await fr.destroy({ transaction });
    return fr;
  });

  for (const filePath of filePaths) {
    try {
      await getStorageDriver().remove(filePath);
    } catch (err) {
      logger.error('Failed to remove attachment file after feature request deletion', { filePath, error: err.message });
    }
  }

  return record;
}

/** R7: only the submitter, a CEO, or an Admin may change a feature request's panel. */
function userCanManagePanel(featureRequest, req) {
  return req.user.id === featureRequest.submittedBy
    || req.user.roleName === 'ceo'
    || isSuperAdmin(req.user.permissions);
}

/**
 * The panel view — identical mechanics to ideas.service.js#buildPanel: any number of REVIEWERS
 * (advisory) and APPROVERS (majority decides once every approver has voted; a tie is broken by
 * any active CEO). Always live, computed from the current feature_request_reviews rows.
 */
async function buildPanel(featureRequest, req) {
  const rows = await FeatureRequestReview.findAll({
    where: { featureRequestId: featureRequest.id },
    include: [
      {
        model: User, as: 'user', attributes: ['id', 'name', 'avatarUrl', 'functionalAreas'],
        include: [{ model: Role, as: 'role', attributes: ['name'] }],
      },
      { model: User, as: 'addedByUser', attributes: ['id', 'name'] },
    ],
    order: [['addedAt', 'ASC'], ['createdAt', 'ASC']],
  });

  const isLive = featureRequest.status === 'under_review';

  const toEntry = (row) => ({
    userId: row.userId,
    name: row.user?.name || null,
    role: ROLE_LABELS[row.user?.role?.name] || row.user?.role?.name || null,
    functionalAreas: row.user?.functionalAreas || [],
    kind: row.kind,
    decision: row.decision,
    note: row.note,
    reviewedAt: row.decision ? row.updatedAt : null,
    addedBy: row.addedByUser ? { id: row.addedByUser.id, name: row.addedByUser.name } : null,
    addedAt: row.addedAt,
    canRemove: false,
  });

  const reviewers = rows.filter((r) => r.kind === 'reviewer').map(toEntry);
  const approvers = rows.filter((r) => r.kind === 'approver').map(toEntry);
  const tiebreakRow = rows.find((r) => r.kind === 'tiebreaker');
  const tiebreak = tiebreakRow ? toEntry(tiebreakRow) : null;

  const reviewersTotal = reviewers.length;
  const reviewersResponded = reviewers.filter((r) => r.decision !== null).length;
  const reviewersOutstanding = reviewersTotal - reviewersResponded;
  const outstandingReviewerNames = reviewers.filter((r) => r.decision === null).map((r) => r.name);
  const approversTotal = approvers.length;
  const approversApproved = approvers.filter((r) => r.decision === 'approve').length;
  const approversRejected = approvers.filter((r) => r.decision === 'reject').length;
  const approversResponded = approversApproved + approversRejected;
  const hasApprover = approversTotal > 0;
  const canDecideNow = hasApprover;
  const isTied = isLive && hasApprover && approversResponded === approversTotal && approversApproved === approversRejected;

  const panel = {
    reviewers, approvers, tiebreak,
    reviewersTotal, reviewersResponded, reviewersOutstanding, outstandingReviewerNames,
    approversTotal, approversApproved, approversRejected,
    hasApprover, canDecideNow, isTied,
    myRow: null,
    canManagePanel: false,
    canTieBreak: false,
  };

  if (!req?.user || !isLive) return panel;

  const viewerCanManage = userCanManagePanel(featureRequest, req);
  panel.canManagePanel = viewerCanManage;
  panel.canTieBreak = isTied && (req.user.roleName === 'ceo' || isSuperAdmin(req.user.permissions));
  [...reviewers, ...approvers].forEach((entry) => {
    entry.canRemove = viewerCanManage && entry.decision === null;
  });

  const myRawRow = rows.find((r) => r.userId === req.user.id && r.kind !== 'tiebreaker');
  if (myRawRow) {
    panel.myRow = {
      kind: myRawRow.kind,
      decision: myRawRow.decision,
      note: myRawRow.note,
      canAct: myRawRow.kind === 'reviewer' ? true : (canDecideNow && !isTied),
    };
  }

  return panel;
}

async function addParticipants(id, { kind, userIds }, req) {
  const featureRequest = await FeatureRequest.findByPk(id);
  if (!featureRequest) throw ApiError.notFound('Feature request not found');
  if (featureRequest.status !== 'under_review') {
    throw ApiError.badRequest('This feature request has been decided — its panel can no longer be changed.');
  }
  if (!userCanManagePanel(featureRequest, req)) {
    throw ApiError.forbidden("Only the submitter, a CEO, or an Admin can change this feature request's panel.");
  }

  const uniqueIds = [...new Set(userIds)];
  const existing = await FeatureRequestReview.findAll({ where: { featureRequestId: id }, attributes: ['userId'] });
  const existingIds = new Set(existing.map((r) => r.userId));

  const users = await User.findAll({
    where: { id: uniqueIds, status: 'active' },
    include: [{ model: Role, as: 'role', include: [{ model: RolePermission, as: 'permissions' }] }],
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  for (const userId of uniqueIds) {
    if (userId === featureRequest.submittedBy) {
      throw ApiError.badRequest("The submitter cannot be added to their own feature request's panel.");
    }
    if (existingIds.has(userId)) {
      throw ApiError.badRequest("One of the selected people is already on this feature request's panel.");
    }
    if (!byId.get(userId)) {
      throw ApiError.badRequest('One of the selected people is not an active user.');
    }
  }

  const now = new Date();
  await FeatureRequestReview.bulkCreate(uniqueIds.map((userId) => ({
    featureRequestId: id, userId, kind, decision: null, note: null, addedBy: req.user.id, addedAt: now,
  })));

  try {
    const recipients = uniqueIds
      .filter((userId) => userId !== req.user.id)
      .map((userId) => ({
        userId,
        type: 'feature_request_panel_added',
        title: kind === 'approver' ? 'You were added as a feature request approver' : 'You were added as a feature request reviewer',
        message: `You were added as ${kind === 'approver' ? 'an approver' : 'a reviewer'} on "${featureRequest.title}".`,
        link: `/feature-requests/${featureRequest.id}`,
      }));
    if (recipients.length > 0) await notificationsService.createMany(recipients);
  } catch (err) {
    logger.error('Failed to create feature-request panel-added notifications', {
      featureRequestId: id, error: { message: err.message, stack: err.stack },
    });
  }

  return getById(id, req);
}

async function removeParticipant(id, userId, req) {
  const featureRequest = await FeatureRequest.findByPk(id);
  if (!featureRequest) throw ApiError.notFound('Feature request not found');
  if (featureRequest.status !== 'under_review') {
    throw ApiError.badRequest('This feature request has been decided — its panel can no longer be changed.');
  }
  if (!userCanManagePanel(featureRequest, req)) {
    throw ApiError.forbidden("Only the submitter, a CEO, or an Admin can change this feature request's panel.");
  }

  const row = await FeatureRequestReview.findOne({ where: { featureRequestId: id, userId } });
  if (!row) throw ApiError.notFound("This person is not on the feature request's panel.");
  if (row.decision !== null) {
    throw ApiError.badRequest('This person has already recorded a verdict — it stays on the record and cannot be removed.');
  }

  await row.destroy();
  return getById(id, req);
}

// eslint-disable-next-line no-unused-vars -- kind kept for symmetry with addParticipants/the route.
async function panelCandidates(id, kind, req) {
  const featureRequest = await FeatureRequest.findByPk(id, { attributes: ['id', 'submittedBy', 'status'] });
  if (!featureRequest) throw ApiError.notFound('Feature request not found');
  if (!userCanManagePanel(featureRequest, req)) {
    throw ApiError.forbidden("Only the submitter, a CEO, or an Admin can manage this feature request's panel.");
  }

  const existing = await FeatureRequestReview.findAll({ where: { featureRequestId: id }, attributes: ['userId'] });
  const excluded = [featureRequest.submittedBy, ...existing.map((r) => r.userId)];

  const users = await User.findAll({
    where: { status: 'active', id: { [Op.notIn]: excluded } },
    include: [{ model: Role, as: 'role' }],
    attributes: ['id', 'name', 'functionalAreas'],
    order: [['name', 'ASC']],
  });

  return users.map((u) => ({
    id: u.id, name: u.name, role: ROLE_LABELS[u.role?.name] || u.role?.name || null, functionalAreas: u.functionalAreas || [],
  }));
}

async function submitReview(id, { decision, note }, req) {
  const featureRequest = await FeatureRequest.findByPk(id, { include });
  if (!featureRequest) throw ApiError.notFound('Feature request not found');

  if (featureRequest.status !== 'under_review') {
    throw ApiError.badRequest('Reviews can only be submitted for a feature request that is Under Review.');
  }

  const myRow = await FeatureRequestReview.findOne({ where: { featureRequestId: featureRequest.id, userId: req.user.id } });
  if (!myRow) return submitTieBreak(featureRequest, { decision, note }, req);

  if (myRow.kind === 'reviewer') {
    if (decision === 'request_changes' && !note?.trim()) {
      throw ApiError.badRequest('A note is required when requesting changes.');
    }
    await myRow.update({ decision, note: note ?? null });
    return getById(id, req);
  }

  if (decision === 'request_changes') {
    throw ApiError.badRequest('Approvers must approve or reject — there is no middle option for a binding vote.');
  }

  const allRows = await FeatureRequestReview.findAll({ where: { featureRequestId: featureRequest.id } });
  const approvers = allRows.filter((r) => r.kind === 'approver');
  const others = approvers.filter((r) => r.id !== myRow.id);
  const allOthersVoted = others.every((r) => r.decision !== null);

  if (!allOthersVoted) {
    await myRow.update({ decision, note: note ?? null });
    return getById(id, req);
  }

  const approveCount = others.filter((r) => r.decision === 'approve').length + (decision === 'approve' ? 1 : 0);
  const rejectCount = others.filter((r) => r.decision === 'reject').length + (decision === 'reject' ? 1 : 0);

  if (approveCount === rejectCount) {
    await myRow.update({ decision, note: note ?? null });
    return getById(id, req);
  }

  const outcome = approveCount > rejectCount ? 'approve' : 'reject';
  return finalizeFeatureRequest(featureRequest, {
    actingRow: myRow, actingRowIsNew: false, actingDecision: decision, note, outcome, reasonRows: allRows,
  }, req);
}

async function submitTieBreak(featureRequest, { decision, note }, req) {
  if (featureRequest.status !== 'under_review') {
    throw ApiError.badRequest('Reviews can only be submitted for a feature request that is Under Review.');
  }
  if (req.user.roleName !== 'ceo' && !isSuperAdmin(req.user.permissions)) {
    throw ApiError.forbidden("You are not on this feature request's review panel.");
  }
  if (decision === 'request_changes') {
    throw ApiError.badRequest('A tie-break must be approve or reject — there is no middle option.');
  }

  const allRows = await FeatureRequestReview.findAll({ where: { featureRequestId: featureRequest.id } });
  const approvers = allRows.filter((r) => r.kind === 'approver');
  if (approvers.length === 0 || approvers.some((r) => r.decision === null)) {
    throw ApiError.badRequest('Approvers have not all voted yet — there is nothing to break a tie on.');
  }
  const approveCount = approvers.filter((r) => r.decision === 'approve').length;
  const rejectCount = approvers.length - approveCount;
  if (approveCount !== rejectCount) {
    throw ApiError.badRequest("This feature request's approvers are not tied — no tie-break is needed.");
  }

  return finalizeFeatureRequest(featureRequest, {
    actingRow: null, actingRowIsNew: true, actingDecision: decision, note, outcome: decision, reasonRows: allRows,
  }, req);
}

/**
 * The terminal transition. Unlike ideas.service.js#finalizeIdea, there is no "register a new
 * Application" branch here at all — a feature request always already has one. Approving always
 * raises a change request against it (see changeRequests.service.js#createFromFeatureRequest for
 * why it starts at `pending`, not pre-approved).
 */
async function finalizeFeatureRequest(featureRequest, { actingRow, actingRowIsNew, actingDecision, note, outcome, reasonRows }, req) {
  const toStatus = outcome === 'approve' ? 'approved' : 'rejected';
  const fromStatus = featureRequest.status;

  const userIds = [...new Set([...reasonRows.map((r) => r.userId), req.user.id])];
  const users = await User.findAll({ where: { id: userIds }, attributes: ['id', 'name'] });
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  const decisionLabels = { approve: 'Approved', reject: 'Rejected' };
  const votes = reasonRows.map((r) => (!actingRowIsNew && r.id === actingRow?.id
    ? { userId: r.userId, kind: r.kind, decision: actingDecision, note: note ?? null }
    : { userId: r.userId, kind: r.kind, decision: r.decision, note: r.note }));
  if (actingRowIsNew) {
    votes.push({ userId: req.user.id, kind: 'tiebreaker', decision: actingDecision, note: note ?? null });
  }
  const reasons = votes
    .filter((v) => v.decision)
    .map((v) => {
      const label = { approver: 'Approver', reviewer: 'Reviewer', tiebreaker: 'Tie-break (CEO)' }[v.kind] || v.kind;
      const d = decisionLabels[v.decision] || v.decision;
      return `${label} ${nameById.get(v.userId) || 'Unknown'} (${d})${v.note ? `: "${v.note}"` : ''}`;
    });
  const finalNote = reasons.length > 0 ? reasons.join('\n') : note;

  let createdChangeRequest = null;
  await sequelize.transaction(async (t) => {
    if (actingRowIsNew) {
      await FeatureRequestReview.create({
        featureRequestId: featureRequest.id, userId: req.user.id, kind: 'tiebreaker', decision: actingDecision,
        note: note ?? null, addedBy: null, addedAt: new Date(),
      }, { transaction: t });
    } else {
      await actingRow.update({ decision: actingDecision, note: note ?? null }, { transaction: t });
    }

    await featureRequest.update({ status: toStatus }, { transaction: t });

    if (toStatus === 'approved') {
      createdChangeRequest = await changeRequestsService.createFromFeatureRequest(featureRequest, { transaction: t });
    }

    await StatusHistory.create({
      entityType: 'feature_request', entityId: featureRequest.id, fromStatus, toStatus, changedBy: req.user.id, note: finalNote,
    }, { transaction: t });
  });

  const recipients = [];
  if (featureRequest.submittedBy !== req.user.id) {
    recipients.push({
      userId: featureRequest.submittedBy, type: 'feature_request_status_change', title: 'Your feature request status changed',
      message: `"${featureRequest.title}" moved from ${fromStatus} to ${toStatus}.`, link: `/feature-requests/${featureRequest.id}`,
    });
  }
  userIds.filter((uid) => uid !== req.user.id && uid !== featureRequest.submittedBy).forEach((uid) => {
    recipients.push({
      userId: uid, type: 'feature_request_status_change', title: "A feature request you're on the panel for was decided",
      message: `"${featureRequest.title}" was ${toStatus === 'approved' ? 'approved' : 'rejected'}.`, link: `/feature-requests/${featureRequest.id}`,
    });
  });

  // Notification #1 (change request delivery track) — the bridge just raised a new, still-pending
  // change request; the application's owner is the one who decides whether it enters their
  // delivery pipeline (changeRequests.service.js#update), so they're the one who needs to know it's
  // waiting, not anyone on the feature request's own review panel.
  if (createdChangeRequest) {
    const application = await Application.findByPk(featureRequest.applicationId, { attributes: ['id', 'ownerId'] });
    if (application?.ownerId && application.ownerId !== req.user.id) {
      recipients.push({
        userId: application.ownerId,
        type: 'change_request_created',
        title: 'A change request needs your review',
        message: `"${createdChangeRequest.title}" was raised against your application.`,
        link: `/applications/${featureRequest.applicationId}/change-requests/${createdChangeRequest.id}`,
      });
    }
  }

  try {
    await notificationsService.createMany(recipients);
  } catch (err) {
    logger.error('Failed to create feature-request finalization notifications', {
      error: { message: err.message, stack: err.stack }, featureRequestId: featureRequest.id,
    });
  }

  return getById(featureRequest.id, req);
}

async function getById(id, req) {
  const record = await base.getById(id);
  if (!req?.user) return record;

  const plain = record.toJSON();
  const panel = await buildPanel(plain, req);

  return { ...plain, panel };
}

async function listAwaitingMyReview({ where, order, limit, offset, page }, req) {
  const myOpenIds = (await FeatureRequestReview.findAll({
    where: { userId: req.user.id, decision: null }, attributes: ['featureRequestId'], raw: true,
  })).map((r) => r.featureRequestId);
  if (myOpenIds.length === 0) {
    return { items: [], pagination: buildPaginationMeta({ page, limit, count: 0 }) };
  }

  const { rows, count } = await FeatureRequest.findAndCountAll({
    where: { [Op.and]: [where, { status: 'under_review' }, { id: { [Op.in]: myOpenIds } }] },
    include, order, limit, offset, distinct: true,
  });
  return { items: rows, pagination: buildPaginationMeta({ page, limit, count }) };
}

async function list(query, req) {
  const { where, order, limit, offset, page } = buildQueryOptions(query, {
    searchableFields: SEARCHABLE_FIELDS,
    filterableFields: FILTERABLE_FIELDS,
  });

  if (query.awaitingMyReview === 'true' && req?.user) {
    return listAwaitingMyReview({ where, order, limit, offset, page }, req);
  }

  const { rows, count } = await FeatureRequest.findAndCountAll({
    where, order, limit, offset, include, distinct: true,
  });
  return { items: rows, pagination: buildPaginationMeta({ page, limit, count }) };
}

async function statusHistory(id) {
  return StatusHistory.findAll({
    where: { entityType: 'feature_request', entityId: id },
    include: [{ model: User, as: 'changedByUser', attributes: ['id', 'name'] }],
    order: [['createdAt', 'ASC']],
  });
}

async function analytics() {
  const [mostPopular, mostReviewed, topContributors] = await Promise.all([
    Vote.findAll({
      attributes: ['entityId', [sequelize.fn('COUNT', sequelize.col('id')), 'voteCount']],
      where: { entityType: 'feature_request', voteType: 'upvote' },
      group: ['entityId'], order: [[sequelize.literal('"voteCount"'), 'DESC']], limit: 5, raw: true,
    }),
    Comment.findAll({
      attributes: ['entityId', [sequelize.fn('COUNT', sequelize.col('id')), 'commentCount']],
      where: { entityType: 'feature_request' },
      group: ['entityId'], order: [[sequelize.literal('"commentCount"'), 'DESC']], limit: 5, raw: true,
    }),
    FeatureRequest.findAll({
      attributes: ['submittedBy', [sequelize.fn('COUNT', sequelize.col('FeatureRequest.id')), 'requestCount']],
      group: ['submittedBy', 'submitter.id'], order: [[sequelize.literal('"requestCount"'), 'DESC']], limit: 5,
      include: [{ model: User, as: 'submitter', attributes: ['id', 'name', 'avatarUrl'] }],
    }),
  ]);

  const ids = [...mostPopular.map((r) => r.entityId), ...mostReviewed.map((r) => r.entityId)];
  const records = await FeatureRequest.findAll({ where: { id: ids }, attributes: ['id', 'title', 'status'] });
  const byId = new Map(records.map((r) => [r.id, r]));

  return {
    mostPopular: mostPopular.map((r) => ({ featureRequest: byId.get(r.entityId), voteCount: Number(r.voteCount) })),
    mostReviewed: mostReviewed.map((r) => ({ featureRequest: byId.get(r.entityId), commentCount: Number(r.commentCount) })),
    topContributors: topContributors.map((r) => ({ submitter: r.submitter, requestCount: Number(r.get('requestCount')) })),
  };
}

module.exports = {
  ...base, create, update, remove, statusHistory, analytics, getById, list,
  submitReview, addParticipants, removeParticipant, panelCandidates,
};

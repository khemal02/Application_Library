const { Op } = require('sequelize');
const {
  Issue, User, Application, Vote, Comment, ChangeRequest, ChangeRequestStage, sequelize,
} = require('../../models');
const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');
const { isSuperAdmin } = require('../../utils/permissions');
const { cleanupEntityRefs, mergeCounts } = require('../../utils/entityCleanup');
const { ROLE_LABELS } = require('../../utils/reviewPanel');
const notificationsService = require('../notifications/notifications.service');

const OPEN_STATUSES = ['needs_triage', 'acknowledged', 'being_fixed'];
const RESOLVED_TAB_STATUSES = ['resolved', 'duplicate', 'not_an_issue'];
const CLOSED_STATUSES = ['resolved', 'known_limitation', 'duplicate', 'not_an_issue'];
const SEVERITY_LABELS = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
const STAGE_ORDER = ['development', 'testing', 'deployment'];

const detailInclude = [
  { model: User, as: 'reporter', attributes: ['id', 'name'] },
  { model: User, as: 'assignee', attributes: ['id', 'name'] },
  { model: Issue, as: 'duplicateOf', attributes: ['id', 'title'] },
  // Set only once convert() has run — lets the frontend render "shows a link to the change
  // request when converted" (Stage 2's own row spec) without a second request.
  { model: ChangeRequest, as: 'changeRequest', attributes: ['id', 'status'] },
];

// needs_triage first, then severity critical -> low, then newest — see the project report,
// Stage 1b. Column names are qualified to "Issue" explicitly — the reporter/assignee includes are
// both User, which also has its own `status` column, and an unqualified `status` in the literal
// is ambiguous the moment those joins are present (only surfaces on list(), which joins both).
const orderClause = [
  [sequelize.literal('CASE WHEN "Issue"."status" = \'needs_triage\' THEN 0 ELSE 1 END'), 'ASC'],
  [sequelize.literal('CASE "Issue"."severity" WHEN \'critical\' THEN 0 WHEN \'high\' THEN 1 WHEN \'medium\' THEN 2 ELSE 3 END'), 'ASC'],
  ['createdAt', 'DESC'],
];

function tabForStatus(status) {
  if (status === 'known_limitation') return 'known_limitation';
  if (RESOLVED_TAB_STATUSES.includes(status)) return 'resolved';
  return 'open';
}

async function getApplication(applicationId) {
  return Application.findByPk(applicationId, { attributes: ['id', 'name', 'ownerId'] });
}

async function requireOwnerOrSuper(applicationId, req, actionLabel) {
  const application = await getApplication(applicationId);
  const isOwner = !!application && application.ownerId === req.user.id;
  if (!isOwner && !isSuperAdmin(req.user.permissions)) {
    throw ApiError.forbidden(`Only the application's owner (or a super-admin) may ${actionLabel}.`);
  }
  return application;
}

/**
 * Reuses `votes` (entityType 'issue', voteType 'upvote') rather than a stored counter — per D3,
 * no new table needed. Attaches meTooCount/iHitThis onto each record via setDataValue (same
 * technique changeRequests.service.js#attachStageNotes uses for stage notes), since neither is a
 * real column on `issues`.
 */
async function attachMeToo(records, userId) {
  if (records.length === 0) return records;
  const ids = records.map((r) => r.id);
  const [countRows, myVotes] = await Promise.all([
    Vote.findAll({
      attributes: ['entityId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      where: { entityType: 'issue', entityId: { [Op.in]: ids }, voteType: 'upvote' },
      group: ['entityId'],
      raw: true,
    }),
    userId ? Vote.findAll({
      attributes: ['entityId'],
      where: {
        entityType: 'issue', entityId: { [Op.in]: ids }, userId, voteType: 'upvote',
      },
      raw: true,
    }) : [],
  ]);
  const countByIssue = new Map(countRows.map((r) => [r.entityId, Number(r.count)]));
  const mySet = new Set(myVotes.map((v) => v.entityId));
  records.forEach((r) => {
    r.setDataValue('meTooCount', countByIssue.get(r.id) || 0);
    r.setDataValue('iHitThis', mySet.has(r.id));
  });
  return records;
}

/**
 * GET / — list, filterable by tab via `group` (open | known_limitation | resolved), matching the
 * three tabs Stage 2 renders. No real pagination — same "fetch a generous cap, page client-side"
 * shape as ChangeRequestsCard/changeRequests.service.js, since this only ever renders inside one
 * card on the Application page, never its own list route.
 */
async function list(applicationId, query, req) {
  const where = { applicationId };
  if (query.group === 'open') where.status = { [Op.in]: OPEN_STATUSES };
  else if (query.group === 'known_limitation') where.status = 'known_limitation';
  else if (query.group === 'resolved') where.status = { [Op.in]: RESOLVED_TAB_STATUSES };

  const records = await Issue.findAll({
    where, include: detailInclude, order: orderClause, limit: 200,
  });
  return attachMeToo(records, req.user.id);
}

async function getById(applicationId, id, req) {
  const record = await Issue.findOne({ where: { id, applicationId }, include: detailInclude });
  if (!record) throw ApiError.notFound('Issue not found');
  const [withMeToo] = await attachMeToo([record], req.user.id);
  return withMeToo;
}

/**
 * POST / — any authenticated user may report. status/reportedBy/assigneeId are forced here, not
 * merely defaulted — the validator already forbids a client from sending them, but the service
 * doesn't trust that alone (same belt-and-suspenders shape used throughout this project).
 */
async function create(applicationId, payload, req) {
  const record = await Issue.create({
    applicationId,
    title: payload.title,
    severity: payload.severity,
    description: payload.description,
    affectedVersion: payload.affectedVersion,
    reportedBy: req.user.id,
    status: 'needs_triage',
  });

  // Notification #1 — the owner needs to triage it. Never notifies an owner about their own report.
  try {
    const application = await getApplication(applicationId);
    if (application?.ownerId && application.ownerId !== req.user.id) {
      await notificationsService.create({
        userId: application.ownerId,
        type: 'issue_reported',
        title: 'A new issue was reported',
        message: `A ${SEVERITY_LABELS[record.severity].toLowerCase()} issue was reported on ${application.name}.`,
        link: `/applications/${applicationId}?issues=open#issue-${record.id}`,
      });
    }
  } catch (err) {
    logger.error('Failed to create issue-reported notification', {
      issueId: record.id, error: { message: err.message, stack: err.stack },
    });
  }

  return getById(applicationId, record.id, req);
}

async function notifyAssigned(applicationId, application, record, assigneeId, req) {
  if (!assigneeId || assigneeId === req.user.id) return;
  try {
    await notificationsService.create({
      userId: assigneeId,
      type: 'issue_assigned',
      title: 'You were assigned an issue',
      message: `${req.user.name} assigned you '${record.title}' on ${application?.name || 'an application'}.`,
      link: `/applications/${applicationId}?issues=open#issue-${record.id}`,
    });
  } catch (err) {
    logger.error('Failed to create issue-assigned notification', {
      issueId: record.id, error: { message: err.message, stack: err.stack },
    });
  }
}

/**
 * PATCH .../:id/triage — the five-outcome triage action. Owner/super-admin only, and only usable
 * from `needs_triage` — a re-triage of an already-decided issue goes through reopen() first.
 *   - accept -> acknowledged; an optional assigneeId immediately promotes it to being_fixed, same
 *     rule assign() applies below (assigning on an acknowledged issue auto-promotes it).
 *   - known_limitation / not_an_issue -> that status; note REQUIRED (a closure with no reason is
 *     what makes people re-report — see Stage 2's dialog copy).
 *   - duplicate -> duplicate; duplicateOfId REQUIRED, must reference an issue on the SAME
 *     application, and cannot reference itself.
 */
async function triage(applicationId, id, payload, req) {
  const record = await Issue.findOne({ where: { id, applicationId } });
  if (!record) throw ApiError.notFound('Issue not found');
  const application = await requireOwnerOrSuper(applicationId, req, 'triage an issue');

  if (record.status !== 'needs_triage') {
    throw ApiError.conflict(`This issue has already been triaged (status: ${record.status}).`);
  }

  const { outcome } = payload;
  const updates = {};
  let notificationMessage;

  if (outcome === 'accept') {
    updates.status = payload.assigneeId ? 'being_fixed' : 'acknowledged';
    if (payload.assigneeId !== undefined) updates.assigneeId = payload.assigneeId;
    notificationMessage = `'${record.title}' was accepted and is being worked on.`;
  } else if (outcome === 'known_limitation' || outcome === 'not_an_issue') {
    if (!payload.note) throw ApiError.badRequest('A note is required to close an issue this way.');
    updates.status = outcome;
    updates.closureNote = payload.note;
    updates.closedAt = new Date();
    notificationMessage = outcome === 'known_limitation'
      ? `'${record.title}' was marked as a known limitation: ${payload.note}`
      : `'${record.title}' was marked as not an issue: ${payload.note}`;
  } else if (outcome === 'duplicate') {
    if (!payload.duplicateOfId) throw ApiError.badRequest('duplicateOfId is required to mark an issue as a duplicate.');
    if (payload.duplicateOfId === id) throw ApiError.conflict('An issue cannot be a duplicate of itself.');
    const original = await Issue.findByPk(payload.duplicateOfId, { attributes: ['id', 'applicationId', 'title'] });
    if (!original || original.applicationId !== applicationId) {
      throw ApiError.conflict('An issue can only be marked a duplicate of another issue on the same application.');
    }
    updates.status = 'duplicate';
    updates.duplicateOfId = payload.duplicateOfId;
    updates.closureNote = payload.note || `Duplicate of "${original.title}".`;
    updates.closedAt = new Date();
    notificationMessage = `'${record.title}' was marked as a duplicate of '${original.title}'.`;
  } else {
    throw ApiError.badRequest(`Unknown triage outcome: ${outcome}`);
  }

  await record.update(updates);

  // Notification #2 — the reporter learns the outcome. Notification #3 reuses the exact same
  // assigned-notification as assign() below — not a second, differently-worded notification.
  try {
    if (record.reportedBy !== req.user.id) {
      await notificationsService.create({
        userId: record.reportedBy,
        type: 'issue_triaged',
        title: 'Your issue was triaged',
        message: notificationMessage,
        link: `/applications/${applicationId}?issues=${tabForStatus(updates.status)}#issue-${id}`,
      });
    }
  } catch (err) {
    logger.error('Failed to create issue-triaged notification', {
      issueId: id, error: { message: err.message, stack: err.stack },
    });
  }
  if (updates.status === 'being_fixed') {
    await notifyAssigned(applicationId, application, record, payload.assigneeId, req);
  }

  return getById(applicationId, id, req);
}

/**
 * PATCH .../:id/assign — owner/super-admin only. Only meaningful once triaged (acknowledged or
 * being_fixed): assigning before triage is what triage's own accept+assigneeId already does;
 * assigning after closure needs reopen() first. Setting an assignee promotes acknowledged ->
 * being_fixed; clearing it drops back to acknowledged — same auto-transition rule as
 * changeRequests' stage assignment, applied to the whole issue instead of one stage.
 */
async function assign(applicationId, id, payload, req) {
  const record = await Issue.findOne({ where: { id, applicationId } });
  if (!record) throw ApiError.notFound('Issue not found');
  const application = await requireOwnerOrSuper(applicationId, req, 'assign this issue');

  if (record.status !== 'acknowledged' && record.status !== 'being_fixed') {
    throw ApiError.conflict(`Cannot assign an issue with status ${record.status} — triage it first.`);
  }

  const previousAssigneeId = record.assigneeId;
  await record.update({
    assigneeId: payload.assigneeId,
    status: payload.assigneeId ? 'being_fixed' : 'acknowledged',
  });

  if (payload.assigneeId !== previousAssigneeId) {
    await notifyAssigned(applicationId, application, record, payload.assigneeId, req);
  }

  return getById(applicationId, id, req);
}

/**
 * Notification #4 — reporter, everyone who hit it, and the owner, deduplicated, `excludeUserId`
 * (the actor, when there is one) removed. Shared between resolve() and the Stage 3 auto-resolve
 * path (changeRequests.service.js#updateStage, when a linked change request completes deployment)
 * — "the resolution notification fires as normal" means literally this code, not a re-implementation.
 */
async function notifyResolved(issue, applicationId, { excludeUserId } = {}) {
  try {
    const application = await getApplication(applicationId);
    const voters = await Vote.findAll({
      where: { entityType: 'issue', entityId: issue.id, voteType: 'upvote' }, attributes: ['userId'],
    });
    const recipients = new Set([issue.reportedBy, ...voters.map((v) => v.userId), application?.ownerId].filter(Boolean));
    if (excludeUserId) recipients.delete(excludeUserId);
    if (recipients.size > 0) {
      await notificationsService.createMany([...recipients].map((userId) => ({
        userId,
        type: 'issue_resolved',
        title: 'An issue was resolved',
        message: `'${issue.title}' was resolved.`,
        link: `/applications/${applicationId}?issues=resolved#issue-${issue.id}`,
      })));
    }
  } catch (err) {
    logger.error('Failed to create issue-resolved notifications', {
      issueId: issue.id, error: { message: err.message, stack: err.stack },
    });
  }
}

/**
 * PATCH .../:id/resolve — the owner, this issue's assignee, or a super-admin. Requires it to
 * already be triaged (acknowledged or being_fixed) — resolving straight from needs_triage would
 * skip triage's own record of what was decided and why. Not usable once a change request has been
 * converted from this issue (see convert()) — its own Resolve action is superseded; that record's
 * Deployment stage completing is the only thing that resolves it from here on.
 */
async function resolve(applicationId, id, payload, req) {
  const record = await Issue.findOne({ where: { id, applicationId } });
  if (!record) throw ApiError.notFound('Issue not found');
  const application = await getApplication(applicationId);
  const isOwner = !!application && application.ownerId === req.user.id;
  const isAssignee = !!record.assigneeId && record.assigneeId === req.user.id;
  if (!isOwner && !isAssignee && !isSuperAdmin(req.user.permissions)) {
    throw ApiError.forbidden('You must be the application\'s owner, this issue\'s assignee, or a super-admin to resolve it.');
  }
  if (!payload.note) throw ApiError.badRequest('A note is required to resolve an issue.');
  if (record.status !== 'acknowledged' && record.status !== 'being_fixed') {
    throw ApiError.conflict(`This issue must be triaged before it can be resolved (status: ${record.status}).`);
  }
  const linkedChangeRequest = await ChangeRequest.findOne({ where: { issueId: id }, attributes: ['id', 'status'] });
  if (linkedChangeRequest) {
    throw ApiError.conflict('This issue resolves automatically when its change request is implemented — it cannot be resolved directly.');
  }

  await record.update({ status: 'resolved', closureNote: payload.note, closedAt: new Date() });
  await notifyResolved(record, applicationId, { excludeUserId: req.user.id });

  return getById(applicationId, id, req);
}

/**
 * POST .../:id/convert — owner/super-admin only, from `needs_triage` or `acknowledged`. Creates
 * the change request already `approved` (the owner has just triaged/is triaging it themselves —
 * there is no second approval to wait for), title/description carried across, `issueId` set, and
 * its three stage rows seeded — all in ONE transaction with the issue's own move to `being_fixed`,
 * per the project report. Deliberately does not go through changeRequests.service.js#create(): that
 * function owns its own transaction and fires the "please review" notification for a request that
 * starts `pending` — neither applies here, this request is born already decided.
 *
 * No notification fires from this action — it isn't in the Stage 1e table, and C5 forbids anyone
 * being notified outside that table. The owner already knows (they just did it); the reporter finds
 * out when the issue later resolves.
 */
async function convert(applicationId, id, req) {
  const record = await Issue.findOne({ where: { id, applicationId } });
  if (!record) throw ApiError.notFound('Issue not found');
  await requireOwnerOrSuper(applicationId, req, 'convert this issue to a change request');

  if (record.status !== 'needs_triage' && record.status !== 'acknowledged') {
    throw ApiError.conflict(`Cannot convert an issue with status ${record.status} to a change request.`);
  }

  await sequelize.transaction(async (transaction) => {
    const cr = await ChangeRequest.create({
      applicationId,
      title: record.title,
      description: record.description,
      requestedBy: req.user.id,
      issueId: record.id,
      status: 'approved',
    }, { transaction });
    await ChangeRequestStage.bulkCreate(
      STAGE_ORDER.map((stage) => ({ changeRequestId: cr.id, stage })),
      { transaction },
    );
    await record.update({ status: 'being_fixed' }, { transaction });
  });

  return getById(applicationId, id, req);
}

/**
 * Called from changeRequests.service.js#updateStage, inside its own transaction, the moment a
 * change request whose `issueId` is set completes Deployment. Mirrors resolve()'s own write
 * exactly (status/closureNote/closedAt) but names the change request rather than taking a caller-
 * supplied note, since there is no human note to carry here. Returns the updated issue so the
 * caller can fire notifyResolved() itself, after ITS OWN transaction commits — a failed
 * notification must never roll back the actual state change, same house rule as everywhere else.
 */
async function resolveViaChangeRequest(issueId, changeRequestTitle, { transaction }) {
  const issue = await Issue.findByPk(issueId, { transaction });
  if (!issue) return null;
  await issue.update({
    status: 'resolved',
    closureNote: `Resolved automatically — change request "${changeRequestTitle}" was implemented.`,
    closedAt: new Date(),
  }, { transaction });
  return issue;
}

/**
 * PATCH .../:id/reopen — owner or super-admin only. Always lands on `acknowledged`, whichever
 * closed status it came from and regardless of whether it still has an assignee — the owner
 * re-triages/re-assigns explicitly rather than this guessing at being_fixed. The required note has
 * no dedicated column on `issues` (only resolve/triage's closure_note does), so it is recorded as
 * a regular note instead — via `Comment.create` DIRECTLY, not `commentsService.create`, and in the
 * SAME transaction as the status update. Going through the service would mean two independent
 * writes with no shared transaction: if the comment insert failed after the status had already
 * flipped, the required note would be silently lost and a retry would then hit the service's own
 * "not closed" 409, stranding the issue reopened-but-unexplained with no way for the caller to
 * tell. Bypassing the service's own authorization/not-closed gate here is correct, not a shortcut
 * — `requireOwnerOrSuper` above already re-does the authorization half, and the not-closed gate is
 * exactly what this transaction is guaranteeing by construction (the status write and the note
 * write commit or roll back together).
 */
async function reopen(applicationId, id, payload, req) {
  const record = await Issue.findOne({ where: { id, applicationId } });
  if (!record) throw ApiError.notFound('Issue not found');
  const application = await requireOwnerOrSuper(applicationId, req, 'reopen this issue');
  if (!CLOSED_STATUSES.includes(record.status)) throw ApiError.conflict('This issue is not closed.');
  if (!payload.note) throw ApiError.badRequest('A note is required to reopen an issue.');

  await sequelize.transaction(async (transaction) => {
    await record.update({ status: 'acknowledged', closedAt: null }, { transaction });
    await Comment.create(
      { entityType: 'issue', entityId: id, userId: req.user.id, body: payload.note },
      { transaction },
    );
  });

  // Notification #5 — the assignee (if set) and the owner, deduplicated, actor excluded.
  try {
    const recipients = new Set([record.assigneeId, application?.ownerId].filter(Boolean));
    recipients.delete(req.user.id);
    if (recipients.size > 0) {
      await notificationsService.createMany([...recipients].map((userId) => ({
        userId,
        type: 'issue_reopened',
        title: 'An issue was reopened',
        message: `'${record.title}' was reopened.`,
        link: `/applications/${applicationId}?issues=open#issue-${id}`,
      })));
    }
  } catch (err) {
    logger.error('Failed to create issue-reopened notifications', {
      issueId: id, error: { message: err.message, stack: err.stack },
    });
  }

  return getById(applicationId, id, req);
}

/**
 * GET .../:id/assignee-candidates — not in Stage 1b's literal endpoint list, added because
 * Stage 2's Accept dialog needs a source for its assignee select and there is no "application's
 * users" roster anywhere in the schema to scope it to (Application has only ownerId/departmentId
 * — no membership table). Mirrors changeRequests.service.js#assigneeCandidates exactly: any active
 * user, not scoped to this application, same reasoning (anyone could reasonably be assigned to fix
 * something).
 */
async function assigneeCandidates() {
  const { Role } = require('../../models');
  const users = await User.findAll({
    where: { status: 'active' },
    include: [{ model: Role, as: 'role' }],
    attributes: ['id', 'name'],
    order: [['name', 'ASC']],
  });
  return users.map((u) => ({
    id: u.id, name: u.name, roleLabel: ROLE_LABELS[u.role?.name] || u.role?.name || null,
  }));
}

/**
 * Called from applications.service.js#remove, in the SAME transaction as the application's own
 * destroy. `issues.application_id` cascades at the DB level (ON DELETE CASCADE), which removes the
 * issue rows themselves automatically — but their comments and votes are polymorphic
 * (entityType/entityId, no real FK) and would otherwise survive as orphans. One cleanup call per
 * issue, merged into a single tally, same shape changeRequests.service.js#remove uses for its
 * stages.
 */
async function cleanupForApplication(applicationId, { transaction }) {
  const issueRows = await Issue.findAll({ where: { applicationId }, attributes: ['id'], transaction });
  const cleanups = await Promise.all(
    issueRows.map((i) => cleanupEntityRefs('issue', i.id, { transaction })),
  );
  return {
    counts: mergeCounts(...cleanups.map((c) => c.counts)),
    filePaths: cleanups.flatMap((c) => c.filePaths),
  };
}

module.exports = {
  list, getById, create, triage, assign, resolve, reopen, convert, assigneeCandidates, cleanupForApplication,
  resolveViaChangeRequest, notifyResolved,
};

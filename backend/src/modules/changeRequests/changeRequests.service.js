const { Op } = require('sequelize');
const { createCrudService } = require('../../utils/crudFactory');
const {
  ChangeRequest, ChangeRequestStage, User, Role, Application, StatusHistory, Comment, sequelize,
} = require('../../models');
const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');
const { isSuperAdmin } = require('../../utils/permissions');
const { cleanupEntityRefs, mergeCounts } = require('../../utils/entityCleanup');
const { getStorageDriver } = require('../attachments/storage');
const { ROLE_LABELS } = require('../../utils/reviewPanel');
const notificationsService = require('../notifications/notifications.service');

const STAGE_ORDER = ['development', 'testing', 'deployment'];
const STAGE_LABELS = { development: 'Development', testing: 'Testing', deployment: 'Deployment' };
const STAGE_STATUS_ORDER = ['not_started', 'in_progress', 'complete'];
// Which statuses a change request's own `status` may move to next. `implemented` deliberately
// has no entry anywhere on the right — it can only ever be written by updateStage() completing
// deployment (rule 5), never through this table.
const REQUEST_STATUS_TRANSITIONS = {
  pending: ['in_review', 'approved', 'rejected'],
  in_review: ['approved', 'rejected'],
  approved: [],
  rejected: [],
  implemented: [],
};

const detailInclude = [
  {
    model: User,
    as: 'requester',
    attributes: ['id', 'name'],
    include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'label'] }],
  },
  // ownerId travels with it so the frontend can compute "am I allowed to act on a stage" (rule 6:
  // owner/assignee/super-admin) without a second request — same shape Stage 2's delete-visibility
  // check already uses for `requestedBy`.
  { model: Application, as: 'application', attributes: ['id', 'name', 'ownerId'] },
  {
    model: ChangeRequestStage,
    as: 'stages',
    include: [{ model: User, as: 'assignee', attributes: ['id', 'name'] }],
  },
];

// Bulk insert / eager-load order isn't a reliable read order — always sort explicitly to
// development/testing/deployment rather than trust the DB's natural row order. Goes through
// setDataValue rather than a plain property assignment — a Sequelize instance's own .toJSON()
// reads from dataValues, so `record.stages = sorted` would silently NOT show up in the actual
// API response even though the in-memory instance looks right.
function sortStages(record) {
  if (record && Array.isArray(record.stages)) {
    const sorted = [...record.stages].sort(
      (a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage),
    );
    record.setDataValue('stages', sorted);
  }
  return record;
}

// Stage notes now live in the generic `comments` table (entityType: 'change_request_stage',
// entityId: the stage's id) — see 20260130000038. One query for all three stages' notes at once,
// oldest first, grouped back onto each stage. Only called from getById() (the detail screen), not
// list() — nothing in the list view ever renders a stage's notes, so fetching them there would just
// be dead weight on every row.
async function attachStageNotes(record) {
  if (!record || !Array.isArray(record.stages) || record.stages.length === 0) return record;
  const stageIds = record.stages.map((s) => s.id);
  const comments = await Comment.findAll({
    where: { entityType: 'change_request_stage', entityId: { [Op.in]: stageIds } },
    include: [{ model: User, as: 'author', attributes: ['id', 'name'] }],
    order: [['createdAt', 'ASC']],
  });
  const byStage = new Map(stageIds.map((id) => [id, []]));
  comments.forEach((c) => {
    byStage.get(c.entityId)?.push({
      id: c.id,
      body: c.body,
      author: c.author ? { id: c.author.id, name: c.author.name } : null,
      createdAt: c.createdAt,
    });
  });
  record.stages.forEach((s) => s.setDataValue('notes', byStage.get(s.id) || []));
  return record;
}

const base = createCrudService(ChangeRequest, {
  searchableFields: ['title', 'description'],
  filterableFields: ['applicationId', 'status'],
  include: detailInclude,
  notFoundMessage: 'Change request not found',
});

// Every change request needs its three stage rows to exist for updateStage() to have anything to
// act on — the migration only backfilled them for the change requests that already existed at
// that point; every one created afterward gets them here, in the same transaction. `requestedBy`
// is always the caller, never taken from the body (see the project report) — the validator
// already strips it, but the service doesn't trust that alone.
async function create(payload, req) {
  const record = await sequelize.transaction(async (t) => {
    const rec = await ChangeRequest.create(
      { ...payload, requestedBy: req.user.id },
      { transaction: t },
    );
    await ChangeRequestStage.bulkCreate(
      STAGE_ORDER.map((stage) => ({ changeRequestId: rec.id, stage })),
      { transaction: t },
    );
    return rec;
  });

  // Notification #1 — a newly pending request needs the application owner's decision (see
  // update()'s governance gate). Fired after commit, per house pattern; never notifies the owner
  // about their own request.
  try {
    const application = await Application.findByPk(record.applicationId, { attributes: ['id', 'ownerId'] });
    if (application?.ownerId && application.ownerId !== req.user.id) {
      await notificationsService.create({
        userId: application.ownerId,
        type: 'change_request_created',
        title: 'A change request needs your review',
        message: `"${record.title}" was raised against your application.`,
        link: `/applications/${record.applicationId}/change-requests/${record.id}`,
      });
    }
  } catch (err) {
    logger.error('Failed to create change-request-created notification', {
      changeRequestId: record.id, error: { message: err.message, stack: err.stack },
    });
  }

  return record;
}

/**
 * Called by featureRequests.service.js#finalizeFeatureRequest, in the SAME transaction as the
 * feature request's own approval — an approved feature request becomes a change request against
 * its target application, so the two either land together or neither does. Internal only:
 * bypasses create()'s own transaction/validator/req entirely, since there's no HTTP request or
 * caller identity here — `requestedBy` is the feature request's original submitter, not whoever
 * cast the deciding vote.
 *
 * Starts at `pending`, deliberately not `approved`: the feature request's panel answered "is this
 * worth doing", but only the application's OWNER decides what enters their delivery pipeline (the
 * same rule change() enforces on every other change request) — a review panel has no guarantee of
 * including them.
 */
async function createFromFeatureRequest(featureRequest, { transaction }) {
  const record = await ChangeRequest.create({
    applicationId: featureRequest.applicationId,
    title: featureRequest.title,
    description: featureRequest.description,
    requestedBy: featureRequest.submittedBy,
    featureRequestId: featureRequest.id,
  }, { transaction });
  await ChangeRequestStage.bulkCreate(
    STAGE_ORDER.map((stage) => ({ changeRequestId: record.id, stage })),
    { transaction },
  );
  return record;
}

async function list(query) {
  const result = await base.list(query);
  result.items.forEach(sortStages);
  return result;
}

async function getById(id) {
  const record = await base.getById(id);
  sortStages(record);
  return attachStageNotes(record);
}

/**
 * Governance transitions on the request's own `status` — overridden rather than left to the
 * generic factory update, because a plain PUT used to be able to write `status: 'approved'` (or
 * even 'implemented') as just another field, with no gate at all. That breaks the whole point of
 * updateStage() below: rule 5 says completing Deployment is the ONLY place 'implemented' is ever
 * written, and approving/rejecting is now restricted to the application's owner (or a
 * super-admin) — not just anyone holding change_requests:update, which per migrations 029-031 is
 * every role. Every other field on the record still goes through untouched.
 */
async function update(id, payload, req) {
  const record = await ChangeRequest.findByPk(id);
  if (!record) throw ApiError.notFound('Change request not found');

  const { status, ...rest } = payload;

  if (status !== undefined && status !== record.status) {
    if (status === 'implemented') {
      throw ApiError.badRequest('A change request becomes implemented when its Deployment stage is completed.');
    }
    const allowed = REQUEST_STATUS_TRANSITIONS[record.status] || [];
    if (!allowed.includes(status)) {
      throw ApiError.badRequest(`Cannot move a change request from ${record.status} to ${status}.`);
    }
    if (status === 'approved' || status === 'rejected') {
      const application = await Application.findByPk(record.applicationId, { attributes: ['id', 'ownerId'] });
      const isOwner = !!application && application.ownerId === req.user.id;
      if (!isOwner && !isSuperAdmin(req.user.permissions)) {
        throw ApiError.forbidden('Only the application\'s owner (or a super-admin) may approve or reject a change request.');
      }
    }
  }

  await sequelize.transaction(async (t) => {
    const fromStatus = record.status;
    await record.update({ ...rest, ...(status !== undefined ? { status } : {}) }, { transaction: t });
    if (status !== undefined && status !== fromStatus) {
      await StatusHistory.create({
        entityType: 'change_request', entityId: record.id, fromStatus, toStatus: status, changedBy: req.user.id, note: null,
      }, { transaction: t });
    }
  });

  return getById(id);
}

/**
 * PATCH .../:id/stages/:stage — the one hand-written action on this module; everything else is
 * generic CRUD. Rules (numbered to match the project report):
 *   1. Stages run in order — a stage stuck at not_started can't be touched until its predecessor
 *      is complete.
 *   2. Only usable once the change request itself is `approved`.
 *   3. A stage's own status only moves forward: not_started -> in_progress -> complete.
 *   4. Moving to in_progress defaults start_date to today if unset; moving to complete defaults
 *      end_date to today if unset. An explicitly supplied date always wins.
 *   5. Completing `deployment` sets the change request's status to `implemented`, in the same
 *      transaction — the only place that ever happens.
 *   6. Authorization: the application's owner, this stage's assignee, or a super-admin. Nobody
 *      else, regardless of role.
 *   7. Two notification points: whoever is newly assigned to a stage, and the NEXT stage's
 *      assignee (if one is already set) the moment the stage ahead of them completes — so someone
 *      idle on Testing finds out Development just finished without having to keep checking back.
 */
async function updateStage(applicationId, id, stage, payload, req) {
  const record = await ChangeRequest.findOne({
    where: { id, applicationId },
    include: [{ model: ChangeRequestStage, as: 'stages' }],
  });
  if (!record) throw ApiError.notFound('Change request not found');

  if (record.status !== 'approved') {
    // Distinct messages, not one generic "not approved" — an implemented or rejected request
    // isn't merely "not approved yet", it's done, and Stage 3's UI branches its copy on which.
    if (record.status === 'implemented') {
      throw ApiError.conflict('This change request is complete and can no longer be changed.');
    }
    if (record.status === 'rejected') {
      throw ApiError.conflict('This change request was rejected.');
    }
    throw ApiError.conflict('This change request has not been approved yet.');
  }

  const stageRow = record.stages.find((s) => s.stage === stage);
  if (!stageRow) throw ApiError.notFound('Stage not found');

  // Rule 1 blocks STARTING a stage out of order — it never blocked naming who'll eventually work
  // it. Gating on `payload.status` (not just this stage's own current status) lets an owner
  // pre-assign Testing's/Deployment's assignee while Development is still running, which is what
  // makes rule 7's "your stage is ready" notification meaningful — without this, nobody could ever
  // already be assigned at the moment a predecessor completes, and that notification would never
  // have anyone to send to.
  const stageIndex = STAGE_ORDER.indexOf(stage);
  if (stageIndex > 0 && stageRow.status === 'not_started' && payload.status !== undefined) {
    const previousStage = STAGE_ORDER[stageIndex - 1];
    const previousRow = record.stages.find((s) => s.stage === previousStage);
    if (previousRow.status !== 'complete') {
      throw ApiError.conflict(`${STAGE_LABELS[previousStage]} must be complete before ${STAGE_LABELS[stage]} can start.`);
    }
  }

  const application = await Application.findByPk(applicationId, { attributes: ['id', 'ownerId'] });
  const isOwner = !!application && application.ownerId === req.user.id;
  const isAssignee = !!stageRow.assigneeId && stageRow.assigneeId === req.user.id;
  const isSuper = isSuperAdmin(req.user.permissions);
  if (!isOwner && !isAssignee && !isSuper) {
    throw ApiError.forbidden('You must be the application\'s owner, this stage\'s assignee, or a super-admin to update it.');
  }
  // Assignment is narrower than the general gate above: only the owner or a super-admin may name
  // or change who a stage is assigned to — the stage's current assignee acting alone must not be
  // able to hand it off (or unassign themselves), even though they can otherwise progress it.
  if (payload.assigneeId !== undefined && !isOwner && !isSuper) {
    throw ApiError.forbidden('Only the application\'s owner (or a super-admin) may assign or reassign this stage.');
  }

  const updates = {};
  let nextStatus = stageRow.status;
  if (payload.status !== undefined && payload.status !== stageRow.status) {
    const fromIdx = STAGE_STATUS_ORDER.indexOf(stageRow.status);
    const toIdx = STAGE_STATUS_ORDER.indexOf(payload.status);
    if (toIdx <= fromIdx) {
      throw ApiError.badRequest(`Cannot move ${stage} from ${stageRow.status} back to ${payload.status}.`);
    }
    nextStatus = payload.status;
    updates.status = nextStatus;
  }
  // Captured before stageRow.update() overwrites it — this is the one fact rule 7's "newly
  // assigned" notification needs and can't recover afterwards.
  const previousAssigneeId = stageRow.assigneeId;
  if (payload.assigneeId !== undefined) updates.assigneeId = payload.assigneeId;
  if (payload.startDate !== undefined) updates.startDate = payload.startDate;
  if (payload.endDate !== undefined) updates.endDate = payload.endDate;

  const today = new Date().toISOString().slice(0, 10);
  if (nextStatus === 'in_progress' && !stageRow.startDate && updates.startDate === undefined) {
    updates.startDate = today;
  }
  if (nextStatus === 'complete' && !stageRow.endDate && updates.endDate === undefined) {
    updates.endDate = today;
  }

  await sequelize.transaction(async (t) => {
    const fromStageStatus = stageRow.status;
    await stageRow.update(updates, { transaction: t });

    if (updates.status && updates.status !== fromStageStatus) {
      await StatusHistory.create({
        entityType: 'change_request',
        entityId: record.id,
        fromStatus: `${stage}: ${fromStageStatus}`,
        toStatus: `${stage}: ${updates.status}`,
        changedBy: req.user.id,
        note: null,
      }, { transaction: t });
    }

    if (stage === 'deployment' && updates.status === 'complete') {
      const fromRequestStatus = record.status;
      await record.update({ status: 'implemented' }, { transaction: t });
      await StatusHistory.create({
        entityType: 'change_request',
        entityId: record.id,
        fromStatus: fromRequestStatus,
        toStatus: 'implemented',
        changedBy: req.user.id,
        note: 'Deployment stage completed',
      }, { transaction: t });
    }
  });

  // Rule 7 — fired after the transaction commits, same as every other notification in this
  // codebase (a failed notification must never roll back the actual state change). Never notifies
  // someone about their own action.
  const link = `/applications/${applicationId}/change-requests/${id}`;
  const recipients = [];
  if (payload.assigneeId && payload.assigneeId !== previousAssigneeId && payload.assigneeId !== req.user.id) {
    recipients.push({
      userId: payload.assigneeId,
      type: 'change_request_stage_assigned',
      title: 'You were assigned to a change request stage',
      message: `You're now assigned to the ${STAGE_LABELS[stage]} stage of "${record.title}".`,
      link,
    });
  }
  if (updates.status === 'complete') {
    const nextStage = STAGE_ORDER[stageIndex + 1];
    const nextStageRow = nextStage && record.stages.find((s) => s.stage === nextStage);
    if (nextStageRow?.assigneeId && nextStageRow.assigneeId !== req.user.id) {
      recipients.push({
        userId: nextStageRow.assigneeId,
        type: 'change_request_stage_ready',
        title: 'A change request stage is ready for you',
        message: `${STAGE_LABELS[stage]} is complete — ${STAGE_LABELS[nextStage]} is ready to start on "${record.title}".`,
        link,
      });
    }
  }
  // Notification #4 — delivered. Both the person who originally raised it and the application
  // owner who governed it through the pipeline get told; whoever completed Deployment doesn't
  // notify themselves, and if the same person is both requester and owner they're still only ever
  // one entry (userId de-duped below).
  if (stage === 'deployment' && updates.status === 'complete') {
    const implementedRecipients = [...new Set([record.requestedBy, application?.ownerId].filter(Boolean))]
      .filter((uid) => uid !== req.user.id);
    implementedRecipients.forEach((uid) => {
      recipients.push({
        userId: uid,
        type: 'change_request_implemented',
        title: 'A change request was implemented',
        message: `"${record.title}" has been fully delivered.`,
        link,
      });
    });
  }
  if (recipients.length > 0) {
    try {
      await notificationsService.createMany(recipients);
    } catch (err) {
      logger.error('Failed to create change-request stage notifications', {
        changeRequestId: id, stage, error: { message: err.message, stack: err.stack },
      });
    }
  }

  return getById(id);
}

/**
 * PATCH .../:id/assignments — bulk-set/clear any of the three stages' assignees in one call, one
 * transaction. Deliberately narrower than updateStage()'s own gate: only the application's owner
 * or a super-admin, full stop — not a stage's own assignee, and not just anyone holding
 * change_requests:update. Only keys present in the body are touched; an absent key leaves that
 * stage alone, an explicit `null` clears it. A `complete` stage can't be reassigned (409, naming
 * it) — finished work keeps the record of who did it. Every requested stage is validated BEFORE
 * anything is written, so a request that fails partway through touches nothing.
 *
 * Returns `{ record, changes }` — `record` is the full change request (same shape as getById, for
 * the frontend to re-render from one response); `changes` is the list of stages whose assigneeId
 * actually changed (a key present in the body but equal to the current value is not a change), for
 * the controller to write one audit log entry per changed stage.
 */
async function bulkAssignStages(applicationId, id, payload, req) {
  const record = await ChangeRequest.findOne({
    where: { id, applicationId },
    include: [{ model: ChangeRequestStage, as: 'stages' }],
  });
  if (!record) throw ApiError.notFound('Change request not found');

  const application = await Application.findByPk(applicationId, { attributes: ['id', 'ownerId'] });
  const isOwner = !!application && application.ownerId === req.user.id;
  if (!isOwner && !isSuperAdmin(req.user.permissions)) {
    throw ApiError.forbidden('Only the application\'s owner (or a super-admin) may assign or reassign these stages.');
  }

  const requestedStages = STAGE_ORDER.filter((stage) => Object.prototype.hasOwnProperty.call(payload, stage));
  const targets = requestedStages.map((stage) => {
    const stageRow = record.stages.find((s) => s.stage === stage);
    if (!stageRow) throw ApiError.notFound(`Stage not found: ${stage}`);
    if (stageRow.status === 'complete') {
      throw ApiError.conflict(`${STAGE_LABELS[stage]} is already complete and cannot be reassigned.`);
    }
    return { stage, stageRow, newAssigneeId: payload[stage] };
  });

  const changes = [];
  await sequelize.transaction(async (t) => {
    for (const { stage, stageRow, newAssigneeId } of targets) {
      const previousAssigneeId = stageRow.assigneeId;
      if (newAssigneeId === previousAssigneeId) continue; // key present but no actual change
      await stageRow.update({ assigneeId: newAssigneeId }, { transaction: t });
      changes.push({
        stage, stageId: stageRow.id, previousAssigneeId, newAssigneeId,
      });
    }
  });

  // Notification #2, reused as-is — fired only for a newly SET assignee, never for a clear, and
  // never for assigning yourself. Same event, same recipient rule as updateStage()'s own version;
  // this is the same notification, not a second one.
  const link = `/applications/${applicationId}/change-requests/${id}`;
  const recipients = changes
    .filter((c) => c.newAssigneeId && c.newAssigneeId !== req.user.id)
    .map((c) => ({
      userId: c.newAssigneeId,
      type: 'change_request_stage_assigned',
      title: 'You were assigned to a change request stage',
      message: `You're now assigned to the ${STAGE_LABELS[c.stage]} stage of "${record.title}".`,
      link,
    }));
  if (recipients.length > 0) {
    try {
      await notificationsService.createMany(recipients);
    } catch (err) {
      logger.error('Failed to create bulk-assignment notifications', {
        changeRequestId: id, error: { message: err.message, stack: err.stack },
      });
    }
  }

  return { record: await getById(id), changes };
}

/**
 * A delivered (implemented) or decided-against (rejected) change request is a record, not a
 * draft — same reasoning Ideas already applies to a decided idea. Not exempting a super-admin:
 * the ownership gate on the delete route (who may attempt it) is separate from this status gate
 * (whether the record's current state permits deletion at all), and this one applies to everyone.
 *
 * The generic crudFactory.remove(id) can't take a transaction, so this is fetch-and-destroy
 * inline, the same shape ideas.service.js#remove uses: cleanupEntityRefs runs in the SAME
 * transaction as the destroy (status_history rows this module writes on every update()/
 * updateStage() transition would otherwise survive as orphans), and any attachment files it
 * returns are only unlinked from disk AFTER the transaction commits — a later rollback must never
 * leave "file gone, row restored".
 */
async function remove(id) {
  let filePaths = [];
  const record = await sequelize.transaction(async (transaction) => {
    const cr = await ChangeRequest.findByPk(id, {
      include: [{ model: ChangeRequestStage, as: 'stages', attributes: ['id'] }],
      transaction,
    });
    if (!cr) throw ApiError.notFound('Change request not found');
    if (cr.status === 'implemented' || cr.status === 'rejected') {
      throw ApiError.badRequest(`A change request that has been ${cr.status} cannot be deleted.`);
    }
    // Stage notes live in `comments` keyed off each STAGE's own id (entityType:
    // 'change_request_stage'), not the change request's — cleanupEntityRefs('change_request', id)
    // alone would never find them, since it only matches entityId === id. One cleanup call per
    // stage, in the same transaction, merged into one tally to log.
    const stageCleanups = await Promise.all(
      cr.stages.map((s) => cleanupEntityRefs('change_request_stage', s.id, { transaction })),
    );
    const requestCleanup = await cleanupEntityRefs('change_request', id, { transaction });
    const cleanup = mergeCounts(requestCleanup, ...stageCleanups);
    filePaths = [...requestCleanup.filePaths, ...stageCleanups.flatMap((c) => c.filePaths)];
    logger.info('Change request deleted — cleaned up dependent rows', { changeRequestId: id, ...cleanup });
    await cr.destroy({ transaction });
    return cr;
  });

  for (const filePath of filePaths) {
    try {
      await getStorageDriver().remove(filePath);
    } catch (err) {
      logger.error('Failed to remove attachment file after change request deletion', { filePath, error: err.message });
    }
  }

  return record;
}

/**
 * GET .../:id/assignee-candidates — any active user, not scoped to this application or narrowed
 * any other way (unlike ideas.service.js#panelCandidates, which excludes the submitter and
 * existing panel members — there's no equivalent exclusion here; anyone could reasonably be
 * assigned to work a stage). Deliberately NOT built on users.service.js's admin listing:
 * GET /api/users is CEO-only by explicit grant, so an assignee dropdown built on it would 403 for
 * the application owner — exactly the person meant to be doing the assigning.
 */
async function assigneeCandidates() {
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

module.exports = {
  ...base, create, list, getById, update, updateStage, bulkAssignStages, remove, assigneeCandidates, createFromFeatureRequest,
};

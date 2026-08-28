const { createCrudService } = require('../../utils/crudFactory');
const {
  ChangeRequest, ChangeRequestStage, User, Role, Application, StatusHistory, sequelize,
} = require('../../models');
const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');
const { isSuperAdmin } = require('../../utils/permissions');
const { cleanupEntityRefs } = require('../../utils/entityCleanup');
const { getStorageDriver } = require('../attachments/storage');
const { ROLE_LABELS } = require('../../utils/reviewPanel');

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

const base = createCrudService(ChangeRequest, {
  searchableFields: ['title', 'description'],
  filterableFields: ['applicationId', 'status', 'priority'],
  include: detailInclude,
  notFoundMessage: 'Change request not found',
});

// Every change request needs its three stage rows to exist for updateStage() to have anything to
// act on — the migration only backfilled them for the change requests that already existed at
// that point; every one created afterward gets them here, in the same transaction. `requestedBy`
// is always the caller, never taken from the body (see the project report) — the validator
// already strips it, but the service doesn't trust that alone.
async function create(payload, req) {
  return sequelize.transaction(async (t) => {
    const record = await ChangeRequest.create(
      { ...payload, requestedBy: req.user.id },
      { transaction: t },
    );
    await ChangeRequestStage.bulkCreate(
      STAGE_ORDER.map((stage) => ({ changeRequestId: record.id, stage })),
      { transaction: t },
    );
    return record;
  });
}

async function list(query) {
  const result = await base.list(query);
  result.items.forEach(sortStages);
  return result;
}

async function getById(id) {
  const record = await base.getById(id);
  return sortStages(record);
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

  const stageIndex = STAGE_ORDER.indexOf(stage);
  if (stageIndex > 0 && stageRow.status === 'not_started') {
    const previousStage = STAGE_ORDER[stageIndex - 1];
    const previousRow = record.stages.find((s) => s.stage === previousStage);
    if (previousRow.status !== 'complete') {
      throw ApiError.conflict(`${STAGE_LABELS[previousStage]} must be complete before ${STAGE_LABELS[stage]} can start.`);
    }
  }

  const application = await Application.findByPk(applicationId, { attributes: ['id', 'ownerId'] });
  const isOwner = !!application && application.ownerId === req.user.id;
  const isAssignee = !!stageRow.assigneeId && stageRow.assigneeId === req.user.id;
  if (!isOwner && !isAssignee && !isSuperAdmin(req.user.permissions)) {
    throw ApiError.forbidden('You must be the application\'s owner, this stage\'s assignee, or a super-admin to update it.');
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
  if (payload.assigneeId !== undefined) updates.assigneeId = payload.assigneeId;
  if (payload.notes !== undefined) updates.notes = payload.notes;
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

  return getById(id);
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
    const cr = await ChangeRequest.findByPk(id, { transaction });
    if (!cr) throw ApiError.notFound('Change request not found');
    if (cr.status === 'implemented' || cr.status === 'rejected') {
      throw ApiError.badRequest(`A change request that has been ${cr.status} cannot be deleted.`);
    }
    const cleanup = await cleanupEntityRefs('change_request', id, { transaction });
    filePaths = cleanup.filePaths;
    logger.info('Change request deleted — cleaned up dependent rows', { changeRequestId: id, ...cleanup.counts });
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
  ...base, create, list, getById, update, updateStage, remove, assigneeCandidates,
};

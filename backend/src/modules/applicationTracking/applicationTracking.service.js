const { Op } = require('sequelize');
const {
  ApplicationTrack, ApplicationTrackStage, Idea, User, Application, StatusHistory, Comment, sequelize,
} = require('../../models');
const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');
const { isSuperAdmin } = require('../../utils/permissions');
const notificationsService = require('../notifications/notifications.service');
// Reused, not duplicated — assigneeCandidates() is generic (any active user, no module-specific
// filtering) and already exported for exactly this. Not a refactor of changeRequests.service.js,
// just calling its existing public API, same as this module already does for
// notificationsService/tagsService-shaped dependencies elsewhere in the codebase (see C4/C9).
const changeRequestsService = require('../changeRequests/changeRequests.service');

const STAGE_ORDER = ['scoping', 'development', 'testing', 'deployment'];
const STAGE_LABELS = {
  scoping: 'Scoping', development: 'Development', testing: 'Testing', deployment: 'Deployment',
};
const STAGE_STATUS_ORDER = ['not_started', 'in_progress', 'complete'];
const STATUS_LABELS = {
  active: 'active', on_hold: 'on hold', live: 'live', cancelled: 'cancelled',
};

const stageIncludeFull = {
  model: ApplicationTrackStage,
  as: 'stages',
  include: [{ model: User, as: 'assignee', attributes: ['id', 'name'] }],
};

// Used by every mutating action below that builds a notification message off `record.name ||
// record.idea?.title` — without the idea include, a track with no name override renders every
// notification as literally the string "undefined" instead of falling through to the idea's title.
const stageAndIdeaInclude = [stageIncludeFull, { model: Idea, as: 'idea', attributes: ['id', 'title'] }];

const detailInclude = [
  { model: Idea, as: 'idea', attributes: ['id', 'ideaNumber', 'title', 'description', 'submittedBy'] },
  { model: User, as: 'owner', attributes: ['id', 'name'] },
  { model: Application, as: 'application', attributes: ['id', 'name'] },
  stageIncludeFull,
];

// Bulk insert / eager-load order isn't a reliable read order — always sort explicitly, same
// reasoning as changeRequests.service.js#sortStages.
function sortStages(record) {
  if (record && Array.isArray(record.stages)) {
    const sorted = [...record.stages].sort(
      (a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage),
    );
    record.setDataValue('stages', sorted);
  }
  return record;
}

// name/description resolve through the idea when the track carries no override — a track always
// has a source idea (idea_id is NOT NULL), so unlike changeRequests.service.js#resolveSource
// there's no "neither is set" case to handle.
function resolveTrack(record) {
  if (!record) return record;
  record.setDataValue('name', record.name || record.idea?.title || null);
  record.setDataValue('description', record.description || record.idea?.description || null);
  return record;
}

function resolveTrackMany(records) {
  records.forEach(resolveTrack);
  return records;
}

// Notes live in the generic `comments` table (entityType: 'application_track_stage', entityId: the
// stage's id) — same shape as changeRequests.service.js#attachStageNotes. Only called from
// getById() (the detail screen); list() never needs a stage's notes.
async function attachStageNotes(record) {
  if (!record || !Array.isArray(record.stages) || record.stages.length === 0) return record;
  const stageIds = record.stages.map((s) => s.id);
  const comments = await Comment.findAll({
    where: { entityType: 'application_track_stage', entityId: { [Op.in]: stageIds } },
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

function isOwnerOrSuper(record, req) {
  return (!!record.ownerId && record.ownerId === req.user.id) || isSuperAdmin(req.user.permissions);
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * GET / — filterable by status, priority, stage, assigneeId. The last two live on the STAGE row,
 * not the track, so they can't be a plain WHERE on ApplicationTrack — filtering via `include.where`
 * would also silently drop the other three stage rows from the response (Sequelize's eager-load
 * `where` restricts which child rows come back, not just which parents match), which would break
 * the four-pip progress rail on every filtered row. Resolved as a two-step: find which track ids
 * have a matching stage row, then filter the main (fully-included) query on `id IN (...)`.
 *
 * Order is the feature: priority critical->low, then target_go_live ascending with nulls last,
 * then oldest first — a literal CASE expression, since Sequelize has no built-in "order by this
 * enum's declared order" and target_go_live's nulls-last needs its own tiebreaker column.
 */
async function list(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  const where = {};
  if (query.status) where.status = query.status;
  if (query.priority) where.priority = query.priority;

  if (query.stage || query.assigneeId) {
    const stageWhere = {};
    if (query.stage) stageWhere.stage = query.stage;
    if (query.assigneeId) stageWhere.assigneeId = query.assigneeId;
    const matches = await ApplicationTrackStage.findAll({ where: stageWhere, attributes: ['applicationTrackId'] });
    const ids = matches.map((m) => m.applicationTrackId);
    // No matches -> a where clause that can never be true, rather than an empty IN() (which some
    // Sequelize/Postgres combinations turn into "always true" if left to chance).
    where.id = { [Op.in]: ids.length ? ids : ['00000000-0000-0000-0000-000000000000'] };
  }

  // A literal ORDER BY referencing the main table's alias behaves inconsistently between
  // findAndCountAll's separate COUNT and SELECT queries once includes are present (the COUNT query
  // doesn't join anything, so a literal naming the "ApplicationTrack" alias fails there with
  // "invalid reference to FROM-clause entry") — run count() and findAll() as two independent
  // queries instead. findAll() keeps Sequelize's default subQuery wrapping (needed so `limit`
  // counts tracks, not the 4x-multiplied joined stage rows) — inside that wrapping the literal
  // correctly resolves against the alias Sequelize itself generates for the subquery.
  const order = [
    [sequelize.literal("CASE \"ApplicationTrack\".\"priority\" WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END"), 'ASC'],
    ['targetGoLive', 'ASC NULLS LAST'],
    ['createdAt', 'ASC'],
  ];

  const count = await ApplicationTrack.count({ where, distinct: true, col: 'id' });
  const rows = await ApplicationTrack.findAll({
    where,
    include: [
      { model: Idea, as: 'idea', attributes: ['id', 'ideaNumber', 'title', 'description'] },
      { model: User, as: 'owner', attributes: ['id', 'name'] },
      { model: Application, as: 'application', attributes: ['id', 'name'] },
      stageIncludeFull,
    ],
    order,
    limit,
    offset,
  });

  rows.forEach(sortStages);
  resolveTrackMany(rows);

  return {
    items: rows,
    pagination: { page, limit, totalItems: count, totalPages: Math.max(Math.ceil(count / limit), 1) },
  };
}

async function getById(id) {
  const record = await ApplicationTrack.findByPk(id, { include: detailInclude });
  if (!record) throw ApiError.notFound('Application track not found');
  sortStages(record);
  await attachStageNotes(record);
  resolveTrack(record);
  return record;
}

/**
 * PATCH /:id — priority, targetGoLive, ownerId, name, description. status/ideaId/applicationId/
 * closedAt are Joi.forbidden() at the validator layer already; this is the authorization + the
 * side effects Joi can't express. Owner or super-admin only (1d) — narrower than plain
 * application_tracks:update, the same "route-level check is coarse, the service is the real gate"
 * shape as everywhere else in this codebase.
 */
async function update(id, payload, req) {
  const record = await ApplicationTrack.findByPk(id, { include: stageAndIdeaInclude });
  if (!record) throw ApiError.notFound('Application track not found');
  if (!isOwnerOrSuper(record, req)) {
    throw ApiError.forbidden("Only this track's owner (or a super-admin) may change it.");
  }

  const priorityChanged = payload.priority !== undefined && payload.priority !== record.priority;
  const fromPriority = record.priority;

  await sequelize.transaction(async (t) => {
    await record.update(payload, { transaction: t });
    // "Every priority change writes status_history and the audit log even when no notification
    // fires, so 'why did this jump the queue?' always has an answer" — written here regardless of
    // the notification branch below.
    if (priorityChanged) {
      await StatusHistory.create({
        entityType: 'application_track',
        entityId: id,
        fromStatus: `priority: ${fromPriority}`,
        toStatus: `priority: ${payload.priority}`,
        changedBy: req.user.id,
        note: null,
      }, { transaction: t });
    }
  });

  if (priorityChanged && payload.priority === 'critical') {
    const name = record.name || record.idea?.title;
    const recipients = [...new Set(
      record.stages.filter((s) => s.assigneeId && s.assigneeId !== req.user.id).map((s) => s.assigneeId),
    )].map((userId) => ({
      userId,
      type: 'application_track_priority_critical',
      title: 'A track you\'re working on is now critical',
      message: `"${name}" is now critical.`,
      link: `/application-tracking/${id}`,
    }));
    if (recipients.length > 0) {
      try {
        await notificationsService.createMany(recipients);
      } catch (err) {
        logger.error('Failed to create track-priority-critical notifications', {
          applicationTrackId: id, error: { message: err.message, stack: err.stack },
        });
      }
    }
  }

  return getById(id);
}

/**
 * PATCH /:id/stages/:stage — the work. Rules numbered to match the discovery report's D6/1e:
 *   1. Stages run in order — not_started can't be left until the predecessor is complete (409).
 *   2. Stage status is forward-only (400 backwards).
 *   3. in_progress defaults start_date to today if unset; complete defaults end_date. Explicit
 *      always wins.
 *   4. Completing `deployment` registers the Application (Stage 2b) — the only place that ever
 *      happens, in the same transaction as the stage completion (see V14: a stage that completes
 *      but fails to register the Application, or the reverse, must never partially persist).
 *   5. Authorization: the stage's assignee, the track owner, or a super-admin may progress it;
 *      only the owner or a super-admin may set/change assigneeId.
 *   6. Every transition writes status_history and the audit log (audit log: controller).
 *   7. Stages cannot be worked while the track is on_hold, cancelled or live — refused with a
 *      message that names the hold reason for on_hold.
 *   8. (Track-level transitions, not stage-level — see hold()/resume()/cancel() below.)
 */
async function updateStage(id, stage, payload, req) {
  const record = await ApplicationTrack.findByPk(id, { include: stageAndIdeaInclude });
  if (!record) throw ApiError.notFound('Application track not found');

  // Rule 7 — checked before anything else; applies to progressing a stage's own status. Doesn't
  // block assignment (see the assign()/updateStage's assigneeId path) — reassigning who'll pick a
  // paused track back up is reasonable; progressing it while paused is exactly what "paused" means.
  if (payload.status !== undefined && record.status !== 'active') {
    if (record.status === 'on_hold') {
      throw ApiError.conflict(`This track is on hold: ${record.closureReason || 'no reason given'} — resume it before continuing this stage.`);
    }
    if (record.status === 'cancelled') {
      throw ApiError.conflict('This track was cancelled — its stages can no longer be worked.');
    }
    throw ApiError.conflict('This track is already live — its stages are complete and can no longer be changed.');
  }

  const stageRow = record.stages.find((s) => s.stage === stage);
  if (!stageRow) throw ApiError.notFound('Stage not found');

  const stageIndex = STAGE_ORDER.indexOf(stage);
  if (stageIndex > 0 && stageRow.status === 'not_started' && payload.status !== undefined) {
    const previousStage = STAGE_ORDER[stageIndex - 1];
    const previousRow = record.stages.find((s) => s.stage === previousStage);
    if (previousRow.status !== 'complete') {
      throw ApiError.conflict(`${STAGE_LABELS[previousStage]} must be complete before ${STAGE_LABELS[stage]} can start.`);
    }
  }

  const isOwner = !!record.ownerId && record.ownerId === req.user.id;
  const isAssignee = !!stageRow.assigneeId && stageRow.assigneeId === req.user.id;
  const isSuper = isSuperAdmin(req.user.permissions);
  if (!isOwner && !isAssignee && !isSuper) {
    throw ApiError.forbidden('You must be this track\'s owner, this stage\'s assignee, or a super-admin to update it.');
  }
  if (payload.assigneeId !== undefined && !isOwner && !isSuper) {
    throw ApiError.forbidden('Only this track\'s owner (or a super-admin) may assign or reassign this stage.');
  }
  // B3: naming who'll pick a PAUSED track back up is reasonable (on_hold falls through). Assigning
  // someone to a track that's already dead — cancelled, or already delivered (live) — is
  // meaningless and would notify them to start work on something that no longer needs it.
  if (payload.assigneeId !== undefined && (record.status === 'cancelled' || record.status === 'live')) {
    throw ApiError.conflict(`This track is ${STATUS_LABELS[record.status]} — its stages can no longer be assigned.`);
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
  const previousAssigneeId = stageRow.assigneeId;
  if (payload.assigneeId !== undefined) updates.assigneeId = payload.assigneeId;
  if (payload.startDate !== undefined) updates.startDate = payload.startDate;
  if (payload.endDate !== undefined) updates.endDate = payload.endDate;

  if (nextStatus === 'in_progress' && !stageRow.startDate && updates.startDate === undefined) {
    updates.startDate = today();
  }
  if (nextStatus === 'complete' && !stageRow.endDate && updates.endDate === undefined) {
    updates.endDate = today();
  }
  // E1: a stage can reach `complete` with no start_date two ways — an explicit clear (Save with
  // the Started field emptied, then a later Mark-complete call that never touches startDate again)
  // or a direct not_started -> complete jump (rule 2 permits it by index; it never passes through
  // the in_progress branch above at all). Same shape as the end_date rule right above it: only
  // fills a genuine hole, never overrides an explicit value from THIS call.
  if (nextStatus === 'complete' && !stageRow.startDate && updates.startDate === undefined) {
    updates.startDate = today();
  }

  // Set only inside the transaction below, on an actual go-live — used after commit to build the
  // "track goes live" notification (needs the idea's author, not otherwise loaded on `record`).
  let goLiveApplicationId = null;
  let ideaSubmittedBy = null;

  await sequelize.transaction(async (t) => {
    const fromStageStatus = stageRow.status;
    await stageRow.update(updates, { transaction: t });
    if (updates.status && updates.status !== fromStageStatus) {
      await StatusHistory.create({
        entityType: 'application_track',
        entityId: record.id,
        fromStatus: `${stage}: ${fromStageStatus}`,
        toStatus: `${stage}: ${updates.status}`,
        changedBy: req.user.id,
        note: null,
      }, { transaction: t });
    }

    // Rule 4 / Stage 2b — the only place this ever happens. Same transaction as the stage
    // completion above: a stage that completes but fails to register the Application (or the
    // reverse) must never partially persist — see V14.
    if (stage === 'deployment' && updates.status === 'complete') {
      const idea = await Idea.findByPk(record.ideaId, {
        attributes: ['id', 'title', 'description', 'departmentId', 'industry', 'functionalArea', 'submittedBy'],
        transaction: t,
      });

      const app = await Application.create({
        // Exactly finalizeIdea's old field list (D1), plus B2's derived release_date. name/
        // description resolve through the track's own override first, else the idea — same
        // resolveTrack() rule the read paths already apply.
        name: record.name || idea.title,
        description: record.description || idea.description,
        departmentId: idea.departmentId,
        industry: idea.industry,
        functionalArea: idea.functionalArea,
        ownerId: record.ownerId,
        // B1: explicit, honest, never the 'development' default — see the discovery report's D13.
        status: 'deployment',
        // B2: derived from the stage that just completed (rule 3 already defaulted it to today if
        // it wasn't set explicitly), not invented. current_version stays NULL — nobody but the
        // owner can know it; they set it later from the Applications edit form.
        releaseDate: updates.endDate || stageRow.endDate,
        // A4: whoever completed Deployment registers it — not the idea's original approver, who
        // may have moved on, changed roles, or simply not be the one who actually delivered it.
        createdBy: req.user.id,
      }, { transaction: t });

      await record.update({ applicationId: app.id, status: 'live', closedAt: today() }, { transaction: t });
      await idea.update({ applicationId: app.id }, { transaction: t });

      await StatusHistory.create({
        entityType: 'application_track', entityId: record.id, fromStatus: 'active', toStatus: 'live', changedBy: req.user.id, note: null,
      }, { transaction: t });

      goLiveApplicationId = app.id;
      ideaSubmittedBy = idea.submittedBy;
    }
  });

  const name = record.name || record.idea?.title;
  const link = `/application-tracking/${id}`;
  const recipients = [];
  if (payload.assigneeId && payload.assigneeId !== previousAssigneeId && payload.assigneeId !== req.user.id) {
    recipients.push({
      userId: payload.assigneeId,
      type: 'application_track_stage_assigned',
      title: 'You were assigned to a track stage',
      message: `You're on the ${STAGE_LABELS[stage]} stage of "${name}".`,
      link,
    });
  }
  if (updates.status === 'complete') {
    const nextStage = STAGE_ORDER[stageIndex + 1];
    const nextStageRow = nextStage && record.stages.find((s) => s.stage === nextStage);
    if (nextStageRow?.assigneeId && nextStageRow.assigneeId !== req.user.id) {
      recipients.push({
        userId: nextStageRow.assigneeId,
        type: 'application_track_stage_ready',
        title: 'A track stage is ready for you',
        message: `${STAGE_LABELS[stage]} is complete — ${STAGE_LABELS[nextStage]} is ready to start on "${name}".`,
        link,
      });
    }
  }
  // 2c: "the track goes live" -> the owner and the idea's author, de-duplicated, actor excluded.
  // Deployment has no next stage, so the "ready for you" block above is naturally a no-op here —
  // this is the one notification that actually fires when Deployment completes.
  if (goLiveApplicationId) {
    const appLink = `/applications/${goLiveApplicationId}`;
    const liveRecipients = [...new Set([record.ownerId, ideaSubmittedBy].filter(Boolean))]
      .filter((uid) => uid !== req.user.id);
    liveRecipients.forEach((uid) => {
      recipients.push({
        userId: uid,
        type: 'application_track_live',
        title: 'A track is now live',
        message: `"${name}" is live and now in the catalogue.`,
        link: appLink,
      });
    });
  }
  if (recipients.length > 0) {
    try {
      await notificationsService.createMany(recipients);
    } catch (err) {
      logger.error('Failed to create track-stage notifications', {
        applicationTrackId: id, stage, error: { message: err.message, stack: err.stack },
      });
    }
  }

  return getById(id);
}

/**
 * POST /:id/stages/assign — bulk assign, mirroring changeRequests.service.js#bulkAssignStages:
 * owner or super-admin only, a `complete` stage can't be reassigned, every requested stage
 * validated before anything is written. NOT gated on `on_hold` (rule 7 gates PROGRESSING a stage,
 * not naming who'll eventually work it — same distinction changeRequests.service.js already draws
 * between updateStage's rule 1 and bulkAssignStages) — but IS gated on `cancelled`/`live` (B3):
 * assigning someone to a dead track is meaningless and would notify them to start work on
 * something that no longer needs it, unlike a merely paused one.
 */
async function assignStages(id, payload, req) {
  const record = await ApplicationTrack.findByPk(id, { include: stageAndIdeaInclude });
  if (!record) throw ApiError.notFound('Application track not found');
  if (!isOwnerOrSuper(record, req)) {
    throw ApiError.forbidden("Only this track's owner (or a super-admin) may assign or reassign these stages.");
  }
  if (record.status === 'cancelled' || record.status === 'live') {
    throw ApiError.conflict(`This track is ${STATUS_LABELS[record.status]} — its stages can no longer be assigned.`);
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
      if (newAssigneeId === previousAssigneeId) continue;
      await stageRow.update({ assigneeId: newAssigneeId }, { transaction: t });
      changes.push({
        stage, stageId: stageRow.id, previousAssigneeId, newAssigneeId,
      });
    }
  });

  const name = record.name || record.idea?.title;
  const link = `/application-tracking/${id}`;
  const recipients = changes
    .filter((c) => c.newAssigneeId && c.newAssigneeId !== req.user.id)
    .map((c) => ({
      userId: c.newAssigneeId,
      type: 'application_track_stage_assigned',
      title: 'You were assigned to a track stage',
      message: `You're on the ${STAGE_LABELS[c.stage]} stage of "${name}".`,
      link,
    }));
  if (recipients.length > 0) {
    try {
      await notificationsService.createMany(recipients);
    } catch (err) {
      logger.error('Failed to create bulk track-assignment notifications', {
        applicationTrackId: id, error: { message: err.message, stack: err.stack },
      });
    }
  }

  return { record: await getById(id), changes };
}

/**
 * PATCH /:id/hold — only from `active` (rule 8). Names the reason so updateStage()'s refusal
 * message (rule 7) can quote it back.
 */
async function hold(id, { reason }, req) {
  const record = await ApplicationTrack.findByPk(id, { include: stageAndIdeaInclude });
  if (!record) throw ApiError.notFound('Application track not found');
  if (!isOwnerOrSuper(record, req)) {
    throw ApiError.forbidden("Only this track's owner (or a super-admin) may put it on hold.");
  }
  if (record.status !== 'active') {
    throw ApiError.conflict(`Only an active track can be put on hold — this one is ${STATUS_LABELS[record.status]}.`);
  }

  const fromStatus = record.status;
  await sequelize.transaction(async (t) => {
    await record.update({ status: 'on_hold', closureReason: reason }, { transaction: t });
    await StatusHistory.create({
      entityType: 'application_track', entityId: id, fromStatus, toStatus: 'on_hold', changedBy: req.user.id, note: reason,
    }, { transaction: t });
  });

  await notifyOwnerAndAssignees(record, req, `"${record.name || record.idea?.title}" was put on hold: ${reason}`);
  return getById(id);
}

/** PATCH /:id/resume — only from `on_hold` (rule 8). No notification — the table lists none. */
async function resume(id, req) {
  const record = await ApplicationTrack.findByPk(id);
  if (!record) throw ApiError.notFound('Application track not found');
  if (!isOwnerOrSuper(record, req)) {
    throw ApiError.forbidden("Only this track's owner (or a super-admin) may resume it.");
  }
  if (record.status !== 'on_hold') {
    throw ApiError.conflict('Only a track that is on hold can be resumed.');
  }

  const fromStatus = record.status;
  await sequelize.transaction(async (t) => {
    await record.update({ status: 'active', closureReason: null }, { transaction: t });
    await StatusHistory.create({
      entityType: 'application_track', entityId: id, fromStatus, toStatus: 'active', changedBy: req.user.id, note: null,
    }, { transaction: t });
  });

  return getById(id);
}

/**
 * PATCH /:id/cancel — from `active` or `on_hold`, never `live` (rule 8). Sets closedAt: cancelling
 * is a genuine closure (never deleted — this IS the record of what was decided), unlike hold's
 * pause.
 */
async function cancel(id, { reason }, req) {
  const record = await ApplicationTrack.findByPk(id, { include: stageAndIdeaInclude });
  if (!record) throw ApiError.notFound('Application track not found');
  if (!isOwnerOrSuper(record, req)) {
    throw ApiError.forbidden("Only this track's owner (or a super-admin) may cancel it.");
  }
  if (record.status === 'live') {
    throw ApiError.badRequest('A live track cannot be cancelled.');
  }
  if (record.status === 'cancelled') {
    throw ApiError.conflict('This track is already cancelled.');
  }

  const fromStatus = record.status;
  await sequelize.transaction(async (t) => {
    await record.update({ status: 'cancelled', closureReason: reason, closedAt: today() }, { transaction: t });
    await StatusHistory.create({
      entityType: 'application_track', entityId: id, fromStatus, toStatus: 'cancelled', changedBy: req.user.id, note: reason,
    }, { transaction: t });
  });

  await notifyOwnerAndAssignees(record, req, `"${record.name || record.idea?.title}" was cancelled: ${reason}`);
  return getById(id);
}

// Shared by hold()/cancel() — owner + every stage assignee, de-duplicated, actor excluded. The
// prompt's own notification table writes one message template ("was put on hold: {reason}") for
// both events under a single row; reusing that literal text for a CANCELLED track would misreport
// what actually happened, so the caller passes its own honest message text in.
async function notifyOwnerAndAssignees(record, req, message) {
  const link = `/application-tracking/${record.id}`;
  const recipientIds = [...new Set([
    record.ownerId,
    ...record.stages.map((s) => s.assigneeId),
  ].filter(Boolean))].filter((uid) => uid !== req.user.id);

  const recipients = recipientIds.map((userId) => ({
    userId, type: 'application_track_status_change', title: 'A track you\'re on changed status', message, link,
  }));
  if (recipients.length === 0) return;
  try {
    await notificationsService.createMany(recipients);
  } catch (err) {
    logger.error('Failed to create track status-change notifications', {
      applicationTrackId: record.id, error: { message: err.message, stack: err.stack },
    });
  }
}

async function assigneeCandidates() {
  return changeRequestsService.assigneeCandidates();
}

module.exports = {
  list,
  getById,
  update,
  updateStage,
  assignStages,
  hold,
  resume,
  cancel,
  assigneeCandidates,
  STAGE_ORDER,
  STAGE_LABELS,
};

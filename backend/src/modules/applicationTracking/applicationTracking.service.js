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

const STAGE_ORDER = ['development', 'testing', 'deployment'];
const STAGE_LABELS = {
  development: 'Development', testing: 'Testing', deployment: 'Deployment',
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
  {
    model: Idea,
    as: 'idea',
    attributes: ['id', 'ideaNumber', 'title', 'description', 'proposedSolution', 'technologiesAndEfficiency', 'submittedBy'],
  },
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
 * GET / — filterable by status, priority, stage, assigneeId, ownerId. `stage`/`assigneeId` live on
 * the STAGE row, not the track, so they can't be a plain WHERE on ApplicationTrack — filtering via
 * `include.where` would also silently drop the other three stage rows from the response
 * (Sequelize's eager-load `where` restricts which child rows come back, not just which parents
 * match), which would break the four-pip progress rail on every filtered row. Resolved as a
 * two-step: find which track ids have a matching stage row, then filter the main (fully-included)
 * query on `id IN (...)`. `ownerId` IS a plain column on the track itself, so it's just a WHERE.
 *
 * Order is the feature: normally priority critical->low, then target_go_live ascending with nulls
 * last — a literal CASE expression, since Sequelize has no built-in "order by this enum's declared
 * order" and target_go_live's nulls-last needs its own tiebreaker column. But once the caller is
 * looking at only THEIR OWN tracks ("Assigned to me" / "My Apps" — assigneeId or ownerId given),
 * the question changes from "what matters most org-wide" to "what do I personally need to start
 * next" — so the order switches to the track's own start_date ascending (nulls last) instead.
 */
async function list(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  const where = {};
  if (query.status) where.status = query.status;
  if (query.priority) where.priority = query.priority;
  if (query.ownerId) where.ownerId = query.ownerId;

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
  const isMineFilter = !!query.assigneeId || !!query.ownerId;
  const order = isMineFilter
    ? [
      ['startDate', 'ASC NULLS LAST'],
      ['createdAt', 'ASC'],
    ]
    : [
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
 *   4. Completing `deployment` does NOT register the Application by itself — it just notifies the
 *      owner the track is ready. Registering it is a deliberate, separate owner action; see
 *      goLive() below.
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
  // Same rule as assigneeId, and for the same reason — planning Started/Expected finish is the
  // owner's job (the same person who names the assignee), not the assignee's own to edit, even
  // though they can otherwise progress/complete the stage they're on.
  if ((payload.startDate !== undefined || payload.endDate !== undefined) && !isOwner && !isSuper) {
    throw ApiError.forbidden('Only this track\'s owner (or a super-admin) may set this stage\'s Started/Expected finish dates.');
  }
  // B3: naming who'll pick a PAUSED track back up is reasonable (on_hold falls through). Assigning
  // someone to a track that's already dead — cancelled, or already delivered (live) — is
  // meaningless and would notify them to start work on something that no longer needs it.
  if (payload.assigneeId !== undefined && (record.status === 'cancelled' || record.status === 'live')) {
    throw ApiError.conflict(`This track is ${STATUS_LABELS[record.status]} — its stages can no longer be assigned.`);
  }
  // No one gets named to a stage until its planned Started/Expected finish dates exist — an
  // assignment with no timeline attached is exactly what the date-planning mechanism above exists
  // to prevent. Only checked when actually naming someone (a truthy assigneeId) — clearing an
  // assignment (assigneeId: null) never needs a timeline. Checks the EFFECTIVE dates (this same
  // call's own startDate/endDate if it happens to carry them too, else whatever's already stored),
  // same as the sequencing guardrail below.
  if (payload.assigneeId) {
    const effectiveStart = payload.startDate !== undefined ? payload.startDate : stageRow.startDate;
    const effectiveEnd = payload.endDate !== undefined ? payload.endDate : stageRow.endDate;
    if (!effectiveStart || !effectiveEnd) {
      throw ApiError.badRequest(`Set ${STAGE_LABELS[stage]}'s Started and Expected finish dates before assigning someone to it.`);
    }
  }
  // Narrower than the general gate above, same reasoning comments.service.js's note-writing rule
  // already applies to this stage's Notes — the document link is the assignee's own deliverable to
  // attach, not the owner's to set on their behalf, even though the owner can otherwise start/
  // complete the stage.
  if (payload.documentUrl !== undefined && !isAssignee && !isSuper) {
    throw ApiError.forbidden('Only this stage\'s assignee (or a super-admin) may set its document link.');
  }

  // Keeps a planned timeline internally consistent — the owner can now set Started/Expected finish
  // for every stage right after the track is created (not just once a stage is in_progress), so
  // without this a Testing window could be planned to start before Development's own planned
  // finish. Only checked when this call actually touches a date; an unrelated update (e.g. just
  // documentUrl) never re-validates dates nobody asked to change. Uses the EFFECTIVE value (this
  // call's new value if given, else whatever's already stored) on both sides of each comparison —
  // normalized to a plain 'YYYY-MM-DD' string first: Joi's `.date()` coerces an incoming payload
  // value into a real JS Date object, while a value read back off the model (DATEONLY) is already
  // a plain string; comparing a Date to a string with </> silently always returns false, which let
  // every cross-stage check below pass no matter what (caught in testing) — normalizing both sides
  // the same way before comparing is what actually makes the comparison work.
  const toDateStr = (value) => {
    if (!value) return value;
    return value instanceof Date ? value.toISOString().slice(0, 10) : value;
  };
  if (payload.startDate !== undefined || payload.endDate !== undefined) {
    const effectiveStart = toDateStr(payload.startDate !== undefined ? payload.startDate : stageRow.startDate);
    const effectiveEnd = toDateStr(payload.endDate !== undefined ? payload.endDate : stageRow.endDate);
    if (effectiveStart && effectiveEnd && effectiveEnd < effectiveStart) {
      throw ApiError.badRequest(`${STAGE_LABELS[stage]}'s Expected finish can't be before its Started date.`);
    }
    if (stageIndex > 0) {
      const predecessor = record.stages.find((s) => s.stage === STAGE_ORDER[stageIndex - 1]);
      const predecessorEnd = toDateStr(predecessor?.endDate);
      if (predecessorEnd && effectiveStart && effectiveStart < predecessorEnd) {
        throw ApiError.badRequest(
          `${STAGE_LABELS[stage]} can't be planned to start before ${STAGE_LABELS[predecessor.stage]}'s expected finish (${predecessorEnd}).`,
        );
      }
    }
    if (stageIndex < STAGE_ORDER.length - 1) {
      const successor = record.stages.find((s) => s.stage === STAGE_ORDER[stageIndex + 1]);
      const successorStart = toDateStr(successor?.startDate);
      if (successorStart && effectiveEnd && effectiveEnd > successorStart) {
        throw ApiError.badRequest(
          `${STAGE_LABELS[stage]} can't be planned to finish after ${STAGE_LABELS[successor.stage]}'s planned start (${successorStart}).`,
        );
      }
    }
    // The track's own startDate/targetGoLive are the overall window the approver set at idea
    // approval (see ideas.service.js#finalizeIdea) — every stage's own planned window must stay
    // inside it, not just consistent with its neighbors. Only enforced when the track actually HAS
    // both bounds set — an idea approved before this pair existed (or approved without them, since
    // neither is required) leaves the track with no outer window to check against, and that's not
    // an error, just nothing to constrain against.
    const trackStart = toDateStr(record.startDate);
    const trackEnd = toDateStr(record.targetGoLive);
    if (trackStart && effectiveStart && effectiveStart < trackStart) {
      throw ApiError.badRequest(
        `${STAGE_LABELS[stage]} can't be planned to start before the track's own Start Date (${trackStart}).`,
      );
    }
    if (trackEnd && effectiveEnd && effectiveEnd > trackEnd) {
      throw ApiError.badRequest(
        `${STAGE_LABELS[stage]} can't be planned to finish after the track's Expected Deployment Date (${trackEnd}).`,
      );
    }
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
  if (payload.documentUrl !== undefined) updates.documentUrl = payload.documentUrl;

  if (nextStatus === 'in_progress' && !stageRow.startDate && updates.startDate === undefined) {
    updates.startDate = today();
  }
  // finishedDate is the actual completion date, set ONLY here, never user-submitted (payload never
  // carries it — see the validator) — endDate ("Expected finish") is a manually-set target the
  // owner controls and is deliberately no longer auto-filled on complete, so the two can't be
  // conflated the way a single overloaded date column used to.
  if (nextStatus === 'complete' && !stageRow.finishedDate) {
    updates.finishedDate = today();
  }
  // E1: a stage can reach `complete` with no start_date two ways — an explicit clear (Save with
  // the Started field emptied, then a later Mark-complete call that never touches startDate again)
  // or a direct not_started -> complete jump (rule 2 permits it by index; it never passes through
  // the in_progress branch above at all).
  if (nextStatus === 'complete' && !stageRow.startDate && updates.startDate === undefined) {
    updates.startDate = today();
  }

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
  // Deployment has no next stage, so the "ready for you" block above is naturally a no-op here.
  // Completing it no longer registers the Application by itself (see goLive() below) — it just
  // tells the owner the track is ready for them to do that, if they weren't the one who just
  // completed it themselves.
  if (stage === 'deployment' && updates.status === 'complete' && record.ownerId && record.ownerId !== req.user.id) {
    recipients.push({
      userId: record.ownerId,
      type: 'application_track_ready_for_go_live',
      title: 'A track is ready to go live',
      message: `All stages of "${name}" are complete — move it to the Applications catalogue when you're ready.`,
      link,
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
 * PATCH /:id/go-live — the deliberate, owner-only step that used to happen automatically the
 * instant Deployment was marked complete. Splitting it out means whoever is assigned Deployment
 * can finish their own work without unilaterally registering the Application on the owner's
 * behalf — the owner (or a super-admin) reviews it and clicks this separately.
 * Same transaction-safety reasoning updateStage's old inline version had (a stage completing
 * without the Application registering, or the reverse, must never partially persist).
 */
async function goLive(id, req) {
  const record = await ApplicationTrack.findByPk(id, { include: stageAndIdeaInclude });
  if (!record) throw ApiError.notFound('Application track not found');
  if (!isOwnerOrSuper(record, req)) {
    throw ApiError.forbidden("Only this track's owner (or a super-admin) may move it to the Applications catalogue.");
  }
  if (record.status !== 'active') {
    throw ApiError.conflict(`Only an active track can go live — this one is ${STATUS_LABELS[record.status]}.`);
  }
  const incomplete = STAGE_ORDER.filter((stage) => record.stages.find((s) => s.stage === stage)?.status !== 'complete');
  if (incomplete.length > 0) {
    throw ApiError.conflict(`${incomplete.map((s) => STAGE_LABELS[s]).join(', ')} must be complete before this track can go live.`);
  }

  const idea = await Idea.findByPk(record.ideaId, {
    attributes: ['id', 'title', 'description', 'departmentId', 'industry', 'functionalArea', 'submittedBy'],
  });
  const deploymentStage = record.stages.find((s) => s.stage === 'deployment');
  let app;

  await sequelize.transaction(async (t) => {
    app = await Application.create({
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
      // B2: derived from whenever Deployment itself was actually completed, not invented — and
      // not today(), which would misreport a track that sat waiting on the owner for a while.
      releaseDate: deploymentStage.endDate,
      // Whoever clicks this registers it — the owner (or a super-admin) making the call, not
      // whoever happened to complete Deployment.
      createdBy: req.user.id,
    }, { transaction: t });

    await record.update({ applicationId: app.id, status: 'live', closedAt: today() }, { transaction: t });
    await idea.update({ applicationId: app.id }, { transaction: t });

    await StatusHistory.create({
      entityType: 'application_track', entityId: record.id, fromStatus: 'active', toStatus: 'live', changedBy: req.user.id, note: null,
    }, { transaction: t });
  });

  const name = record.name || idea.title;
  const appLink = `/applications/${app.id}`;
  const recipients = [...new Set([record.ownerId, idea.submittedBy].filter(Boolean))]
    .filter((uid) => uid !== req.user.id)
    .map((userId) => ({
      userId, type: 'application_track_live', title: 'A track is now live', message: `"${name}" is live and now in the catalogue.`, link: appLink,
    }));
  if (recipients.length > 0) {
    try {
      await notificationsService.createMany(recipients);
    } catch (err) {
      logger.error('Failed to create track-live notifications', {
        applicationTrackId: id, error: { message: err.message, stack: err.stack },
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
  goLive,
  assignStages,
  hold,
  resume,
  cancel,
  assigneeCandidates,
  STAGE_ORDER,
  STAGE_LABELS,
};

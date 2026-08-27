const { Op } = require('sequelize');
const { createCrudService } = require('../../utils/crudFactory');
const { buildQueryOptions, buildPaginationMeta } = require('../../utils/paginate');
const {
  ApplicationSuggestion, User, Role, Application, Department, StatusHistory, SuggestionReview, sequelize,
} = require('../../models');
const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');
const { isSuperAdmin } = require('../../utils/permissions');
const {
  SUGGESTION_STAGE_OWNERS, ROLE_LABELS, SUGGESTION_STATUS_LABELS,
} = require('./suggestions.constants');
const {
  eligibleReviewers, eligibleReviewersForRoles, buildReviewPanel, buildMyReviewSlot,
} = require('../../utils/reviewPanel');
const notificationsService = require('../notifications/notifications.service');
const { cleanupEntityRefs, mergeCounts } = require('../../utils/entityCleanup');
const { getStorageDriver } = require('../attachments/storage');

const SEARCHABLE_FIELDS = ['title', 'description', 'currentProblem', 'suggestedSolution'];
const FILTERABLE_FIELDS = ['applicationId', 'departmentId', 'functionalArea', 'status', 'priority', 'submittedBy', 'assignedTo'];

const include = [
  { model: User, as: 'submitter', attributes: ['id', 'name', 'avatarUrl'] },
  { model: User, as: 'assignee', attributes: ['id', 'name', 'avatarUrl'] },
  { model: Application, as: 'application', attributes: ['id', 'name'] },
  { model: Department, as: 'department', attributes: ['id', 'name'] },
];

const base = createCrudService(ApplicationSuggestion, {
  searchableFields: SEARCHABLE_FIELDS,
  filterableFields: FILTERABLE_FIELDS,
  include,
  notFoundMessage: 'Suggestion not found',
});

// technical_review is now the parallel review panel (team_lead/manager review independently,
// ceo gated on both of them being done — see suggestion_reviews), exactly like Ideas'
// under_review/PARALLEL_ROLES/TERMINAL_ROLE model. Its two outgoing edges are ONLY reachable via
// submitDecision, never the generic PATCH .../status (see transition()'s lockout). `discussion` is
// retired — request_changes (the only thing that ever led there) is gone, since ceo's decision is
// now binding and terminal, same as Ideas'.
const TRANSITIONS = {
  submitted: ['technical_review'],
  technical_review: ['approved', 'rejected'],
  approved: ['assigned'],
  assigned: ['implemented'],
  implemented: ['closed'],
  rejected: [],
  closed: [],
};

// The CEO's panel decision doubles as the transition target out of technical_review — a 1:1
// mapping onto TRANSITIONS.technical_review's exact two targets. Mirrors Ideas' DECISION_TO_STATUS.
const DECISION_TO_STATUS = {
  approve: 'approved',
  reject: 'rejected',
};

/**
 * Only specific roles may advance a suggestion out of a given stage — see SUGGESTION_STAGE_OWNERS
 * — AND only if they hold the suggestion's functional area (or via the nobody-covers-this-area
 * fallback) — see eligibleReviewers. Department plays no part; it's not a routing signal. Unlike
 * Ideas' equivalent, a status ABSENT from SUGGESTION_STAGE_OWNERS
 * (approved/assigned/implemented/closed/rejected) is NOT locked down to admin-only — those are
 * execution steps this panel doesn't govern, so they fall through to "allowed," deferring entirely
 * to the flat `suggestions:review` permission the route already checks. Only the global wildcard
 * (Admin's `*`:`manage`) bypasses the review-gated stages.
 */
async function stageOwnerAllows(suggestion, req) {
  if (isSuperAdmin(req.user.permissions)) return true;

  const owners = SUGGESTION_STAGE_OWNERS[suggestion.status];
  if (!owners) return true;
  if (!owners.includes(req.user.roleName)) return false;

  const { users } = await eligibleReviewers(suggestion, req.user.roleName);
  return users.some((u) => u.id === req.user.id);
}

/** Throwing form for the mutating transition() call site. */
async function assertCanTransition(suggestion, req) {
  if (await stageOwnerAllows(suggestion, req)) return;

  const owners = SUGGESTION_STAGE_OWNERS[suggestion.status];
  const stageLabel = SUGGESTION_STATUS_LABELS[suggestion.status] || suggestion.status;
  const ownerLabels = owners.map((name) => ROLE_LABELS[name] || name).join(' or ');
  if (!owners.includes(req.user.roleName)) {
    throw ApiError.forbidden(`Only ${ownerLabels} can move a suggestion out of ${stageLabel}.`);
  }
  throw ApiError.forbidden(`Only ${ownerLabels} for this suggestion's functional area can move it out of ${stageLabel}.`);
}

/**
 * departmentId/functionalArea aren't collected on the submit form — every suggestion is FOR a
 * specific existing Application, so both auto-fill from it (department falls back to the
 * submitter's own if the application has none; functionalArea has no such fallback and stays
 * null). An explicit value in the payload (e.g. an admin creating on someone's behalf) still wins.
 * Mirrors ideas.service.js#create's existing_app_feature branch, simplified since every suggestion
 * is that case — there's no "no target application yet" lane here.
 */
async function create(payload, req) {
  const targetApp = await Application.findByPk(payload.applicationId, {
    attributes: ['id', 'name', 'departmentId', 'functionalArea'],
  });
  const departmentId = payload.departmentId ?? targetApp?.departmentId ?? req.user.departmentId;
  const functionalArea = payload.functionalArea || targetApp?.functionalArea || null;

  const suggestion = await ApplicationSuggestion.create({
    ...payload, departmentId, functionalArea, submittedBy: req.user.id,
  });

  // Nobody sees a brand-new suggestion unless they go looking — broadcast immediately to every
  // active user org-wide, mirroring the same decision made for Ideas' creation notification.
  try {
    const allUsers = await User.findAll({
      where: { status: 'active', id: { [Op.ne]: req.user.id } },
      attributes: ['id'],
    });
    const recipients = allUsers.map((u) => ({
      userId: u.id,
      type: 'suggestion_submitted',
      title: 'A new suggestion was submitted',
      message: `"${suggestion.title}" — a suggestion for "${targetApp?.name || 'an application'}" — was submitted.`,
      link: `/suggestions/${suggestion.id}`,
    }));
    if (recipients.length > 0) await notificationsService.createMany(recipients);
  } catch (err) {
    logger.error('Failed to create suggestion-submitted notifications', {
      suggestionId: suggestion.id, error: { message: err.message, stack: err.stack },
    });
  }

  return getById(suggestion.id, req);
}

async function transition(id, { toStatus, note, assignedTo }, req) {
  const suggestion = await ApplicationSuggestion.findByPk(id, { include });
  if (!suggestion) throw ApiError.notFound('Suggestion not found');

  const allowed = TRANSITIONS[suggestion.status] || [];
  if (!allowed.includes(toStatus)) {
    throw ApiError.badRequest(`Cannot move a suggestion from "${suggestion.status}" to "${toStatus}"`);
  }

  // technical_review is governed by the panel, not a direct status change — team_lead/manager/ceo
  // are all listed as its "stage owners" (for panel-membership and notification purposes), which
  // would otherwise let any of them bypass the panel entirely via this generic endpoint. Only
  // POST /suggestions/:id/decision (CEO-gated, panel-aware) may move a suggestion out of
  // technical_review. Super admin keeps its usual emergency-override escape hatch.
  if (suggestion.status === 'technical_review' && !isSuperAdmin(req.user.permissions)) {
    throw ApiError.badRequest('Technical Review is governed by the review panel — team leads and managers vote via POST /suggestions/:id/reviews; only the CEO can finalize it, via POST /suggestions/:id/decision.');
  }

  await assertCanTransition(suggestion, req);

  return applyTransition(suggestion, { toStatus, note, assignedTo }, req);
}

/** The mutation + notification core shared by transition() and submitDecision(). */
async function applyTransition(suggestion, { toStatus, note, assignedTo }, req) {
  if (toStatus === 'assigned' && !assignedTo) {
    throw ApiError.badRequest('An assignee (assignedTo) is required to move this suggestion to Assigned');
  }

  const fromStatus = suggestion.status;
  const updates = {
    status: toStatus,
    ...(toStatus === 'assigned' ? { assignedTo } : {}),
  };

  await sequelize.transaction(async (t) => {
    await suggestion.update(updates, { transaction: t });

    await StatusHistory.create({
      entityType: 'suggestion', entityId: suggestion.id, fromStatus, toStatus, changedBy: req.user.id, note,
    }, { transaction: t });
  });

  const recipients = [];

  if (suggestion.submittedBy !== req.user.id) {
    recipients.push({
      userId: suggestion.submittedBy,
      type: 'suggestion_status_change',
      title: 'Your suggestion status changed',
      message: `"${suggestion.title}" moved from ${fromStatus} to ${toStatus}.`,
      link: `/suggestions/${suggestion.id}`,
    });
  }

  const toStatusOwners = SUGGESTION_STAGE_OWNERS[toStatus] || [];
  if (toStatusOwners.length > 0) {
    const candidatesByRole = await eligibleReviewersForRoles(suggestion, toStatusOwners);
    const reviewerIds = [...new Set(
      toStatusOwners.flatMap((role) => (candidatesByRole.get(role)?.users || []).map((u) => u.id)),
    )];
    reviewerIds
      .filter((userId) => userId !== req.user.id)
      .forEach((userId) => {
        recipients.push({
          userId,
          type: 'suggestion_review_required',
          title: 'A suggestion needs your review',
          message: `"${suggestion.title}" is awaiting your review.`,
          link: `/suggestions/${suggestion.id}`,
        });
      });
  }

  if (toStatus === 'assigned' && assignedTo && assignedTo !== req.user.id) {
    recipients.push({
      userId: assignedTo,
      type: 'suggestion_assigned',
      title: 'A suggestion was assigned to you',
      message: `"${suggestion.title}" was assigned to you for implementation.`,
      link: `/suggestions/${suggestion.id}`,
    });
  }

  try {
    await notificationsService.createMany(recipients);
  } catch (err) {
    logger.error('Failed to create suggestion transition notifications', {
      error: { message: err.message, stack: err.stack }, suggestionId: suggestion.id,
    });
  }

  return getById(suggestion.id, req);
}

/**
 * Casts (or updates) the caller's own panel-slot vote at technical_review. One slot per ROLE, not
 * per person (suggestion_reviews' UNIQUE(suggestion_id, role_name)) — mirrors
 * ideas.service.js#submitReview exactly. Does not move the suggestion by itself — only
 * POST /suggestions/:id/decision (CEO) finalizes it.
 */
async function submitReview(id, { decision, note }, req) {
  const suggestion = await ApplicationSuggestion.findByPk(id);
  if (!suggestion) throw ApiError.notFound('Suggestion not found');

  if (suggestion.status !== 'technical_review') {
    throw ApiError.badRequest('Reviews can only be submitted for a suggestion that is in Technical Review.');
  }

  const owners = SUGGESTION_STAGE_OWNERS.technical_review;
  if (!owners.includes(req.user.roleName)) {
    throw ApiError.forbidden(`Only ${owners.map((r) => ROLE_LABELS[r] || r).join(', ')} may submit a panel review.`);
  }

  const { users } = await eligibleReviewers(suggestion, req.user.roleName);
  if (!users.some((u) => u.id === req.user.id)) {
    throw ApiError.forbidden(`You are not eligible to review this suggestion's ${ROLE_LABELS[req.user.roleName] || req.user.roleName} slot — it belongs to a different functional area.`);
  }

  const existing = await SuggestionReview.findOne({ where: { suggestionId: suggestion.id, roleName: req.user.roleName } });
  if (existing) {
    await existing.update({ reviewerId: req.user.id, decision, note: note ?? null });
  } else {
    await SuggestionReview.create({
      suggestionId: suggestion.id, roleName: req.user.roleName, reviewerId: req.user.id, decision, note: note ?? null,
    });
  }

  if (suggestion.submittedBy !== req.user.id) {
    try {
      const verb = { approve: 'approved', reject: 'rejected' }[decision];
      await notificationsService.create({
        userId: suggestion.submittedBy,
        type: 'suggestion_review_submitted',
        title: 'A reviewer weighed in on your suggestion',
        message: `${ROLE_LABELS[req.user.roleName] || req.user.roleName} ${verb} "${suggestion.title}".`,
        link: `/suggestions/${suggestion.id}`,
      });
    } catch (err) {
      logger.error('Failed to create suggestion review-submitted notification', {
        error: { message: err.message, stack: err.stack }, suggestionId: suggestion.id,
      });
    }
  }

  return getById(id, req);
}

/**
 * The CEO's binding decision on a technical_review suggestion — mirrors
 * ideas.service.js#submitDecision exactly: hard-gated on team_lead AND manager both having
 * recorded, no override escape hatch, decision is binding and terminal.
 */
async function submitDecision(id, { decision, note }, req) {
  const suggestion = await ApplicationSuggestion.findByPk(id, { include });
  if (!suggestion) throw ApiError.notFound('Suggestion not found');

  if (suggestion.status !== 'technical_review') {
    throw ApiError.badRequest('A panel decision can only be made for a suggestion that is in Technical Review.');
  }

  if (!isSuperAdmin(req.user.permissions) && req.user.roleName !== 'ceo') {
    throw ApiError.forbidden('Only the CEO can finalize a panel decision.');
  }

  if (!isSuperAdmin(req.user.permissions)) {
    const { users } = await eligibleReviewers(suggestion, 'ceo');
    if (!users.some((u) => u.id === req.user.id)) {
      throw ApiError.forbidden('You are not an eligible CEO reviewer for this suggestion.');
    }
  }

  const [teamLeadReview, managerReview] = await Promise.all([
    SuggestionReview.findOne({ where: { suggestionId: suggestion.id, roleName: 'team_lead' } }),
    SuggestionReview.findOne({ where: { suggestionId: suggestion.id, roleName: 'manager' } }),
  ]);
  const panelComplete = Boolean(teamLeadReview) && Boolean(managerReview);
  if (!panelComplete) {
    const missing = [!teamLeadReview && 'Team Lead', !managerReview && 'Manager'].filter(Boolean);
    throw ApiError.badRequest(`Waiting on ${missing.join(' and ')} before the CEO can decide.`);
  }

  const toStatus = DECISION_TO_STATUS[decision];
  if (!(TRANSITIONS[suggestion.status] || []).includes(toStatus)) {
    throw ApiError.badRequest(`Cannot move a suggestion from "${suggestion.status}" to "${toStatus}"`);
  }

  const existingCeoReview = await SuggestionReview.findOne({ where: { suggestionId: suggestion.id, roleName: 'ceo' } });
  if (existingCeoReview) {
    await existingCeoReview.update({ reviewerId: req.user.id, decision, note: note ?? null });
  } else {
    await SuggestionReview.create({
      suggestionId: suggestion.id, roleName: 'ceo', reviewerId: req.user.id, decision, note: note ?? null,
    });
  }

  return applyTransition(suggestion, { toStatus, note }, req);
}

/**
 * Every active user eligible for the suggestion's CURRENT stage, broken out per owner role.
 * Mirrors ideas.service.js#eligibleReviewersForIdea. Returns empty roles/anyRoleUsedFallback=false
 * for a status SUGGESTION_STAGE_OWNERS doesn't recognize (the execution-stage tail) — there's
 * nothing to review there, not a fallback condition.
 */
async function eligibleReviewersForSuggestion(id) {
  const suggestion = await ApplicationSuggestion.findByPk(id, {
    attributes: ['id', 'status', 'functionalArea'],
  });
  if (!suggestion) throw ApiError.notFound('Suggestion not found');

  const owners = SUGGESTION_STAGE_OWNERS[suggestion.status] || [];
  const candidatesByRole = await eligibleReviewersForRoles(suggestion, owners);
  const roles = owners.map((roleName) => ({
    roleName,
    roleLabel: ROLE_LABELS[roleName] || roleName,
    users: candidatesByRole.get(roleName)?.users || [],
    usedFallback: candidatesByRole.get(roleName)?.usedFallback ?? false,
  }));

  return {
    roles,
    users: roles.flatMap((r) => r.users),
    anyRoleUsedFallback: roles.some((r) => r.usedFallback),
  };
}

/** Shadows base.getById to also compute per-viewer transition gating — mirrors ideas.service.js#getById. */
async function getById(id, req) {
  const suggestion = await base.getById(id);
  if (!req?.user) return suggestion;

  const plain = suggestion.toJSON();
  const allowed = TRANSITIONS[plain.status] || [];
  const owners = SUGGESTION_STAGE_OWNERS[plain.status];
  const isLivePanel = plain.status === 'technical_review';

  const candidatesByRole = isLivePanel ? await eligibleReviewersForRoles(plain, owners) : null;

  // NOBODY can invoke the generic transition endpoint at technical_review, not even an eligible
  // CEO — see the lockout in transition(). For every other status, stageOwnerAllows already
  // returns true for stages SUGGESTION_STAGE_OWNERS doesn't govern (the execution-stage tail).
  const canAct = isLivePanel ? false : await stageOwnerAllows(plain, req);

  // Always built, regardless of current status — a permanent audit trail of who decided what,
  // same as Ideas' reviewPanel. usedFallback reports null for every slot once the panel isn't live
  // (candidatesByRole is null), rather than a stale/misleading true-or-false.
  const reviewPanel = await buildReviewPanel({
    ReviewModel: SuggestionReview, entityIdField: 'suggestionId', entityId: plain.id, candidatesByRole,
  });
  const myReviewSlot = isLivePanel ? buildMyReviewSlot(req.user, candidatesByRole, reviewPanel.slots) : null;

  return {
    ...plain,
    availableTransitions: canAct ? allowed : [],
    stageOwnerRoles: (owners || []).map((name) => ROLE_LABELS[name] || name),
    reviewPanel: reviewPanel?.slots ?? null,
    panelComplete: reviewPanel?.panelComplete ?? null,
    myReviewSlot,
  };
}

/**
 * Shadows base.list to add `awaitingMyReview=true` — mirrors ideas.service.js#list exactly, just
 * against SUGGESTION_STAGE_OWNERS/SuggestionReview. `submitted`/`discussion` are the single-claim
 * stages; `technical_review` is the panel.
 */
async function list(query, req) {
  const { where, order, limit, offset, page } = buildQueryOptions(query, {
    searchableFields: SEARCHABLE_FIELDS,
    filterableFields: FILTERABLE_FIELDS,
  });

  let finalWhere = where;
  if (query.awaitingMyReview === 'true' && req?.user) {
    const myRole = req.user.roleName;
    const relevantStatuses = Object.keys(SUGGESTION_STAGE_OWNERS)
      .filter((status) => SUGGESTION_STAGE_OWNERS[status].includes(myRole));
    const claimStatuses = relevantStatuses.filter((s) => s !== 'technical_review');
    const isPanelRole = relevantStatuses.includes('technical_review');

    const orConditions = [];

    if (claimStatuses.length > 0) {
      orConditions.push({ status: { [Op.in]: claimStatuses } });
    }

    if (isPanelRole) {
      const reviewedSuggestionIds = (await SuggestionReview.findAll({
        where: { roleName: myRole }, attributes: ['suggestionId'], raw: true,
      })).map((r) => r.suggestionId);

      const panelCondition = {
        status: 'technical_review',
        ...(reviewedSuggestionIds.length > 0 ? { id: { [Op.notIn]: reviewedSuggestionIds } } : {}),
      };

      if (myRole !== 'ceo') {
        const myFunctionalAreas = req.user.functionalAreas || [];

        // Functional areas that DO have an active holder of my role — department plays no part;
        // it's not a routing signal here. Mirrors ideas.service.js#list's identical shape.
        const roleHolders = await User.findAll({
          where: { status: 'active' },
          include: [{ model: Role, as: 'role', where: { name: myRole } }],
          attributes: ['functionalAreas'],
          raw: true,
        });
        const functionalAreasWithMyRole = [...new Set(roleHolders.flatMap((r) => r.functionalAreas || []))];

        if (functionalAreasWithMyRole.length > 0) {
          const orParts = [];
          if (myFunctionalAreas.length > 0) {
            orParts.push({ functionalArea: { [Op.in]: myFunctionalAreas } });
          }
          orParts.push({ [Op.or]: [{ functionalArea: null }, { functionalArea: { [Op.notIn]: functionalAreasWithMyRole } }] });
          panelCondition[Op.or] = orParts;
        }
        // else: nobody anywhere holds my role's functional area, so every suggestion falls back
        // to org-wide — no restriction needed at all.
      }

      orConditions.push(panelCondition);
    }

    finalWhere = orConditions.length > 0
      ? { [Op.and]: [where, { [Op.or]: orConditions }] }
      : { [Op.and]: [where, { id: null }] };
  }

  const { rows, count } = await ApplicationSuggestion.findAndCountAll({
    where: finalWhere, order, limit, offset, include, distinct: true,
  });
  return { items: rows, pagination: buildPaginationMeta({ page, limit, count }) };
}

async function statusHistory(id) {
  return StatusHistory.findAll({
    where: { entityType: 'suggestion', entityId: id },
    include: [{ model: User, as: 'changedByUser', attributes: ['id', 'name'] }],
    order: [['createdAt', 'ASC']],
  });
}

/**
 * Overrides base.remove — same reasoning as ideas' override: cannot delegate to base.remove()
 * since crudFactory's generic remove(id) has no way to accept a transaction, and the suggestion's
 * own destroy() must commit together with its polymorphic cleanup or not at all. A suggestion has
 * TWO live comment channels (the general 'suggestion' thread and the separate 'suggestion_note'
 * Discussion notes — unlike ideas, these were never merged), so both get cleaned. No decided-status
 * delete guard here — that rule is specific to ideas' review chain and wasn't asked for here.
 */
async function remove(id) {
  let filePaths = [];
  const suggestion = await sequelize.transaction(async (transaction) => {
    const record = await ApplicationSuggestion.findByPk(id, { transaction });
    if (!record) throw ApiError.notFound('Suggestion not found');
    const forSuggestion = await cleanupEntityRefs('suggestion', id, { transaction });
    const forNote = await cleanupEntityRefs('suggestion_note', id, { transaction });
    filePaths = [...forSuggestion.filePaths, ...forNote.filePaths];
    logger.info('Suggestion deleted — cleaned up dependent rows', {
      suggestionId: id, ...mergeCounts(forSuggestion.counts, forNote.counts),
    });
    await record.destroy({ transaction });
    return record;
  });

  for (const filePath of filePaths) {
    try {
      await getStorageDriver().remove(filePath);
    } catch (err) {
      logger.error('Failed to remove attachment file after suggestion deletion', { filePath, error: err.message });
    }
  }

  return suggestion;
}

module.exports = {
  ...base, create, transition, submitReview, submitDecision, eligibleReviewersForSuggestion, getById, list, statusHistory, remove,
};

const { Op } = require('sequelize');
const { createCrudService } = require('../../utils/crudFactory');
const { buildQueryOptions, buildPaginationMeta } = require('../../utils/paginate');
const {
  Idea, User, Role, RolePermission, Department, Application, StatusHistory, Vote, Comment, IdeaReview, sequelize,
} = require('../../models');
const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');
const { hasPermission, isSuperAdmin } = require('../../utils/permissions');
const { PANEL_KINDS, ROLE_LABELS, IDEA_STATUS_LABELS } = require('./ideas.constants');
const notificationsService = require('../notifications/notifications.service');
const tagsService = require('../tags/tags.service');
const { cleanupEntityRefs, mergeCounts } = require('../../utils/entityCleanup');
const { getStorageDriver } = require('../attachments/storage');

const SEARCHABLE_FIELDS = ['title', 'description', 'businessProblem', 'proposedSolution'];
const FILTERABLE_FIELDS = ['status', 'priority', 'departmentId', 'submittedBy', 'estimatedComplexity', 'category', 'applicationId', 'industry', 'functionalArea', 'internalUse'];

const include = [
  { model: User, as: 'submitter', attributes: ['id', 'name', 'avatarUrl'] },
  { model: User, as: 'reviewer', attributes: ['id', 'name', 'avatarUrl'] },
  { model: Department, as: 'department', attributes: ['id', 'name'] },
  { model: Application, as: 'application', attributes: ['id', 'name'] },
];

const base = createCrudService(Idea, {
  searchableFields: SEARCHABLE_FIELDS,
  filterableFields: FILTERABLE_FIELDS,
  include,
  notFoundMessage: 'Idea not found',
});

// The fixed team_lead -> manager -> ceo chain (REVIEW_CHAIN/PARALLEL_ROLES/TERMINAL_ROLE,
// computeReviewState, buildReviewChain, maybeNotifyCeo, finalizeChain) is gone — see
// 20260130000026-idea-panel-participants.js and ideas.constants.js. Ideas no longer imports
// eligibleReviewers/eligibleReviewersForRoles from utils/reviewPanel.js at all — that module stays
// untouched and shared with Suggestions' own (still functional-area-routed) panel; Ideas' new
// panel has no auto-routing to borrow it for.
//
// Each idea now carries an open panel: any number of REVIEWERS (advisory — never move the idea)
// and any number of APPROVERS, who decide it by majority once every approver has voted (a tie is
// broken by any active CEO — see submitTieBreak()). Reviewers and approvers act fully in
// parallel — neither ever waits on the other; the only wait an approver has is on every OTHER
// approver, to know whether their vote is the one that completes the majority. Composed by the
// submitter (or a CEO/Admin — see canManagePanel below) via addParticipants()/
// removeParticipant(), voted on via submitReview() below, and rendered via buildPanel(), the one
// place R5's zero-approver stall is computed — live, every time, from the current idea_reviews
// rows, never cached.

async function create(payload, req) {
  const { tags, ...rest } = payload;
  // Neither lane collects department/industry/functionalArea on its form — both auto-fill them,
  // but from different sources. A new_idea has no natural department of its own yet, so it
  // inherits the submitter's (industry/functionalArea have no equivalent submitter-level source,
  // so they simply stay whatever was explicitly sent, usually null). A feature request is FOR an
  // existing Application, which already has all three — that's the more correct categorization
  // for all of them: department for org-chart/display purposes (an Employee in dept X requesting
  // a feature on dept Y's app should show as dept Y's concern, not X's), and functionalArea/
  // industry as the app's actual domain rather than whatever the requester happens to guess.
  // functionalArea is now display/reporting-only — it no longer drives review routing (the panel
  // is manually composed, see above) — department falls back to the submitter's own if the
  // application itself has none; industry/functionalArea have no such fallback and simply stay
  // null if the application doesn't have them either. An explicitly supplied value (e.g. an admin
  // creating on someone's behalf) always wins over any of this.
  const category = rest.category || 'new_idea';
  let { departmentId, industry, functionalArea } = rest;
  let targetApp = null;
  if (category === 'existing_app_feature' && rest.applicationId) {
    targetApp = await Application.findByPk(rest.applicationId, { attributes: ['id', 'name', 'departmentId', 'industry', 'functionalArea'] });
    if (departmentId == null) departmentId = targetApp?.departmentId ?? req.user.departmentId;
    if (!industry) industry = targetApp?.industry ?? null;
    if (!functionalArea) functionalArea = targetApp?.functionalArea ?? null;
  } else if (departmentId == null) {
    departmentId = req.user.departmentId;
  }
  const idea = await Idea.create({ ...rest, departmentId, industry, functionalArea, submittedBy: req.user.id });
  if (tags?.length) await tagsService.setForEntity('idea', idea.id, tags);

  // Ideas are created directly at discussion now (submitted is retired) — nobody sees a brand-new
  // idea unless they go looking. Submission and "open for discussion" are the same event (there's
  // no separate discussion-entry trigger), so one broadcast covers both: every active user
  // org-wide gets notified, not just the functional-area-matched Team Lead — discussion is meant
  // to be company-wide, not gated to whoever happens to own the idea's functional area. Applies to BOTH
  // categories. The submitter doesn't notify themselves. Failure here must never break idea
  // creation — logged and swallowed, never surfaced. The panel starts EMPTY — the submitter (or a
  // CEO/Admin) adds reviewers/approvers afterward, from the idea's own detail page.
  //
  // Copy varies by category: "a new idea" about a request to change an application someone already
  // owns is misleading — the title and message need to say which kind of thing this is, and for a
  // feature request specifically, WHICH application, since that's what tells a reader whether it's
  // relevant to them.
  try {
    const isFeatureRequest = idea.category === 'existing_app_feature';
    const allUsers = await User.findAll({
      where: { status: 'active', id: { [Op.ne]: req.user.id } },
      attributes: ['id'],
    });
    const recipients = allUsers.map((u) => ({
      userId: u.id,
      type: 'idea_submitted',
      title: isFeatureRequest ? 'A feature request is open for discussion' : 'A new idea is open for discussion',
      message: isFeatureRequest
        ? `"${idea.title}" — a feature request for "${targetApp?.name || 'an application'}" — is open for discussion.`
        : `"${idea.title}" was submitted and is open for discussion.`,
      link: `/ideas/${idea.id}`,
    }));
    if (recipients.length > 0) await notificationsService.createMany(recipients);
  } catch (err) {
    logger.error('Failed to create idea-submitted notifications', {
      ideaId: idea.id, error: { message: err.message, stack: err.stack },
    });
  }

  return getById(idea.id, req);
}

/**
 * Overrides base.update — once an idea is approved or rejected, nothing about it may change.
 * Reviewers approved (or rejected) a specific record, and on approve an Application was
 * registered from it; rewriting title/description/etc. afterwards would make that record false,
 * the same reasoning the comment-thread freeze already enforces. The frontend's own
 * canEditDescription check is a convenience — this is the actual rule, since a UI-only guard is
 * trivially bypassed by calling the API directly.
 */
async function update(id, payload) {
  const idea = await Idea.findByPk(id, { attributes: ['id', 'status'] });
  if (!idea) throw ApiError.notFound('Idea not found');
  if (idea.status === 'approved' || idea.status === 'rejected') {
    throw ApiError.badRequest('This idea has been decided — it can no longer be edited.');
  }
  return base.update(id, payload);
}

/**
 * Overrides base.remove — same reasoning as update, stronger: deleting a decided idea destroys
 * its recorded verdicts and status history, and orphans the Application it registered (nothing
 * would point back to the idea it came from). No super-admin bypass, deliberately — this isn't a
 * workflow override like a panel change, it's data loss; if an idea genuinely needs to go after a
 * decision, that's a deliberate database operation, not something this button should do for you.
 *
 * Cannot delegate to base.remove() here — crudFactory's generic remove(id) has no way to accept a
 * transaction, and the whole point is that the idea's own destroy() and its polymorphic cleanup
 * (comments/replies + their attachments, votes, tags, status history, notifications — see
 * utils/entityCleanup.js) commit together or not at all. Reimplemented inline instead: not a
 * second copy of crudFactory's logic, just a fetch+destroy that base.remove structurally can't do
 * inside a transaction. Both 'idea' and the legacy 'idea_note' entityType are cleaned — comments
 * freeze/creation already treats them as equivalent (IDEA_ENTITY_TYPES in comments.service.js),
 * and nothing guarantees zero remaining 'idea_note' rows from before Stage 1's merge migration.
 * idea_reviews rows (the panel) are NOT handled here — that table has a real FK with
 * ON DELETE CASCADE (see entityCleanup.js's own docstring), so the DB removes them on its own.
 *
 * Attachment files are removed from disk only AFTER the transaction commits — see
 * entityCleanup.js's own docstring for why unlinking eagerly, inside the transaction, would be
 * wrong (a later rollback would leave files gone but rows restored).
 */
async function remove(id) {
  let filePaths = [];
  const idea = await sequelize.transaction(async (transaction) => {
    const record = await Idea.findByPk(id, { transaction });
    if (!record) throw ApiError.notFound('Idea not found');
    if (record.status === 'approved' || record.status === 'rejected') {
      throw ApiError.badRequest('This idea has been decided — it can no longer be deleted.');
    }
    const forIdea = await cleanupEntityRefs('idea', id, { transaction });
    const forIdeaNote = await cleanupEntityRefs('idea_note', id, { transaction });
    filePaths = [...forIdea.filePaths, ...forIdeaNote.filePaths];
    logger.info('Idea deleted — cleaned up dependent rows', {
      ideaId: id, ...mergeCounts(forIdea.counts, forIdeaNote.counts),
    });
    await record.destroy({ transaction });
    return record;
  });

  for (const filePath of filePaths) {
    try {
      await getStorageDriver().remove(filePath);
    } catch (err) {
      logger.error('Failed to remove attachment file after idea deletion', { filePath, error: err.message });
    }
  }

  return idea;
}

/**
 * Can this person own an Application — the rule eligibleOwners() (below) exposes for the owner
 * picker, and finalizeIdea() enforces on whoever gets chosen there. NOT an approver-eligibility
 * rule anymore: approvers are "any active user" now, same as reviewers (an Employee can approve;
 * see addParticipants()/panelCandidates() below) — owning the resulting Application afterward is
 * a distinct, ongoing responsibility that still requires applications:update/manage, independent
 * of who voted for it. `user` must have its `role.permissions` eager-loaded.
 */
function isEligibleOwner(user) {
  const permissions = (user.role?.permissions || []).map((p) => ({ resource: p.resource, action: p.action }));
  return hasPermission(permissions, 'applications', 'update');
}

/** R7: only the submitter, a CEO, or an Admin may change an idea's panel. */
function userCanManagePanel(idea, req) {
  return req.user.id === idea.submittedBy
    || req.user.roleName === 'ceo'
    || isSuperAdmin(req.user.permissions);
}

/**
 * The panel view for one idea: every reviewer/approver with their verdict, and the counts R5's
 * zero-approver stall is computed from — always live, from the current idea_reviews rows, never
 * cached. Reviewers and approvers act fully in parallel — an approver never waits on reviewers
 * (that gate existed briefly and was removed at your request; `reviewersOutstanding`/
 * `outstandingReviewerNames` stay as pure information, not a gate on anything). `myRow`/
 * `canManagePanel`/`canRemove` are viewer-dependent and only computed when `req` is supplied
 * (mirrors getById's own req-optional contract). Both are null'd out entirely once the idea is
 * decided (R8) — the historical reviewers/approvers arrays already show what everyone decided;
 * there's nothing left to act on.
 */
async function buildPanel(idea, req) {
  const rows = await IdeaReview.findAll({
    where: { ideaId: idea.id },
    include: [
      {
        model: User, as: 'user', attributes: ['id', 'name', 'avatarUrl', 'functionalAreas'],
        include: [{ model: Role, as: 'role', attributes: ['name'] }],
      },
      { model: User, as: 'addedByUser', attributes: ['id', 'name'] },
    ],
    order: [['addedAt', 'ASC'], ['createdAt', 'ASC']],
  });

  const isLive = idea.status === 'under_review';

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
  const hasApprover = approversTotal > 0; // R5 — zero approvers, this idea can never be decided
  const canDecideNow = hasApprover; // R5's stall is the only gate left — reviewers no longer block approvers
  // R1: majority decides once every approver has voted — a tie (only possible with an even
  // approver count) doesn't resolve on its own. Only meaningful while still live; once decided
  // (via a normal majority or a tie-break), this is moot — `tiebreak` above carries the record of
  // what actually broke it, if anything did.
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

  const viewerCanManage = userCanManagePanel(idea, req);
  panel.canManagePanel = viewerCanManage;
  // R7's tie-break is a role check (any active CEO, org-wide — mirrors how the CEO used to be
  // auto-resolved before this panel model existed), deliberately NOT panel membership — R1's tie
  // is the one case where "add someone to the panel first" would be one more thing a submitter
  // could forget, leaving a tied idea permanently stuck. isSuperAdmin gets the same emergency
  // escape hatch every other panel-management action already has.
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

/**
 * R6/R7: adds one or more people to an idea's panel. Always allowed while the idea is live (R8
 * blocks it once decided); restricted to the submitter, a CEO, or an Admin (R7). R3: the
 * submitter may never be added. R4: any active user may be a reviewer OR an approver — the same
 * eligibility either way; an Employee can approve. Only the SEPARATE question of who may own the
 * resulting Application (finalizeIdea()'s ownerId, picked from eligibleOwners()) keeps its own
 * applications:update/manage requirement. Logged by the controller.
 */
async function addParticipants(id, { kind, userIds }, req) {
  const idea = await Idea.findByPk(id);
  if (!idea) throw ApiError.notFound('Idea not found');
  if (idea.status !== 'under_review') {
    throw ApiError.badRequest("This idea has been decided — its panel can no longer be changed.");
  }
  if (!userCanManagePanel(idea, req)) {
    throw ApiError.forbidden("Only the submitter, a CEO, or an Admin can change this idea's panel.");
  }

  const uniqueIds = [...new Set(userIds)];
  const existing = await IdeaReview.findAll({ where: { ideaId: id }, attributes: ['userId'] });
  const existingIds = new Set(existing.map((r) => r.userId));

  const users = await User.findAll({
    where: { id: uniqueIds, status: 'active' },
    include: [{ model: Role, as: 'role', include: [{ model: RolePermission, as: 'permissions' }] }],
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  for (const userId of uniqueIds) {
    if (userId === idea.submittedBy) {
      throw ApiError.badRequest("The submitter cannot be added to their own idea's panel.");
    }
    if (existingIds.has(userId)) {
      throw ApiError.badRequest("One of the selected people is already on this idea's panel.");
    }
    const user = byId.get(userId);
    if (!user) {
      throw ApiError.badRequest('One of the selected people is not an active user.');
    }
  }

  const now = new Date();
  await IdeaReview.bulkCreate(uniqueIds.map((userId) => ({
    ideaId: id, userId, kind, decision: null, note: null, addedBy: req.user.id, addedAt: now,
  })));

  try {
    const recipients = uniqueIds
      .filter((userId) => userId !== req.user.id)
      .map((userId) => ({
        userId,
        type: 'idea_panel_added',
        title: kind === 'approver' ? 'You were added as an idea approver' : 'You were added as an idea reviewer',
        message: `You were added as ${kind === 'approver' ? 'an approver' : 'a reviewer'} on "${idea.title}".`,
        link: `/ideas/${idea.id}`,
      }));
    if (recipients.length > 0) await notificationsService.createMany(recipients);
  } catch (err) {
    logger.error('Failed to create idea panel-added notifications', {
      ideaId: id, error: { message: err.message, stack: err.stack },
    });
  }

  return getById(id, req);
}

/**
 * R6: removing someone who has NOT recorded a verdict is allowed — the only escape hatch for a
 * panel stalled by a silent reviewer (R10: no bypass, override, or timeout is added instead).
 * Removing someone who HAS recorded a verdict is refused; their verdict stays on the record. R7
 * gates who may call this the same way addParticipants does.
 */
async function removeParticipant(id, userId, req) {
  const idea = await Idea.findByPk(id);
  if (!idea) throw ApiError.notFound('Idea not found');
  if (idea.status !== 'under_review') {
    throw ApiError.badRequest("This idea has been decided — its panel can no longer be changed.");
  }
  if (!userCanManagePanel(idea, req)) {
    throw ApiError.forbidden("Only the submitter, a CEO, or an Admin can change this idea's panel.");
  }

  const row = await IdeaReview.findOne({ where: { ideaId: id, userId } });
  if (!row) throw ApiError.notFound("This person is not on the idea's panel.");
  if (row.decision !== null) {
    throw ApiError.badRequest('This person has already recorded a verdict — it stays on the record and cannot be removed.');
  }

  await row.destroy();
  return getById(id, req);
}

/**
 * The picker list for adding a REVIEWER or an APPROVER — R4: any active user is eligible for
 * either kind (identical list either way), minus the submitter (R3) and anyone already on the
 * panel in either kind (one row per person per idea). `kind` is accepted for the caller's own
 * bookkeeping (which picker this is for) but doesn't change who's returned. Same
 * submitter/ceo/admin-only audience as actually changing the panel (R7).
 */
// eslint-disable-next-line no-unused-vars -- kind kept in the signature for symmetry with addParticipants/the route, even though R4 no longer differentiates by it.
async function panelCandidates(id, kind, req) {
  const idea = await Idea.findByPk(id, { attributes: ['id', 'submittedBy', 'status'] });
  if (!idea) throw ApiError.notFound('Idea not found');
  if (!userCanManagePanel(idea, req)) {
    throw ApiError.forbidden("Only the submitter, a CEO, or an Admin can manage this idea's panel.");
  }

  const existing = await IdeaReview.findAll({ where: { ideaId: id }, attributes: ['userId'] });
  const excluded = [idea.submittedBy, ...existing.map((r) => r.userId)];

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

/**
 * Records the caller's own panel verdict. R2: a reviewer's verdict never moves the idea — just
 * recorded, visible in buildPanel(). Reviewers and approvers act fully in parallel — an approver
 * never has to wait on reviewers (that gate existed briefly and was removed at your request); the
 * only thing an approver ever waits on is every OTHER approver, to compute the majority.
 *
 * R1 (majority, not unanimous-plus-veto): an approver's vote is always just recorded — nobody's
 * single reject ends anything anymore. Once EVERY approver has voted, the outcome is whichever
 * side has more votes; a majority approve (for a new_idea with no Application yet) registers one,
 * ownerId required only from the vote that completes the set. A TIE doesn't resolve here at all —
 * see submitTieBreak() below, the one case where panel membership isn't the authorization.
 *
 * No super-admin override and no asRole for a normal vote (R10) — panel membership is the
 * authorization; you can only ever record your own row.
 */
async function submitReview(id, { decision, note, ownerId }, req) {
  const idea = await Idea.findByPk(id, { include });
  if (!idea) throw ApiError.notFound('Idea not found');

  if (idea.status !== 'under_review') {
    throw ApiError.badRequest('Reviews can only be submitted for an idea that is Under Review.');
  }

  const myRow = await IdeaReview.findOne({ where: { ideaId: idea.id, userId: req.user.id } });
  if (!myRow) return submitTieBreak(idea, { decision, note, ownerId }, req);

  if (myRow.kind === 'reviewer') {
    await myRow.update({ decision, note: note ?? null });
    return getById(id, req);
  }

  // Approver from here on — binding, so there's no middle option; `request_changes` is only ever
  // valid for a reviewer's advisory verdict (see ideas.validator.js#submitReview).
  if (decision === 'request_changes') {
    throw ApiError.badRequest('Approvers must approve or reject — there is no middle option for a binding vote.');
  }

  // No gate on reviewers; the only thing left to check is whether every
  // OTHER approver has already voted, to know if this is the completing vote.
  const allRows = await IdeaReview.findAll({ where: { ideaId: idea.id } });
  const approvers = allRows.filter((r) => r.kind === 'approver');
  const others = approvers.filter((r) => r.id !== myRow.id);
  const allOthersVoted = others.every((r) => r.decision !== null);

  if (!allOthersVoted) {
    // Not the completing vote — nothing else can be decided by it, safe to just save.
    await myRow.update({ decision, note: note ?? null });
    return getById(id, req);
  }

  // This IS the completing vote — the FULL tally (including it) decides the outcome, atomically.
  const approveCount = others.filter((r) => r.decision === 'approve').length + (decision === 'approve' ? 1 : 0);
  const rejectCount = others.filter((r) => r.decision === 'reject').length + (decision === 'reject' ? 1 : 0);

  if (approveCount === rejectCount) {
    // Tied — record this vote, but do NOT finalize. Nothing decides it until submitTieBreak().
    await myRow.update({ decision, note: note ?? null });
    return getById(id, req);
  }

  const outcome = approveCount > rejectCount ? 'approve' : 'reject';
  return finalizeIdea(idea, {
    actingRow: myRow, actingRowIsNew: false, actingDecision: decision, note, ownerId, outcome, reasonRows: allRows,
  }, req);
}

/**
 * The tie-break — the ONE place authorization isn't panel membership. Reached only when
 * submitReview() finds no panel row for the caller; if the idea isn't actually tied, that's just
 * "you're not on this panel," same as ever. Any active CEO (org-wide, same resolution the CEO
 * used to get automatically before this panel model existed) or Admin may cast the deciding vote
 * — it becomes the outcome directly, no further tally. Recorded as its own `kind: 'tiebreaker'`
 * row for the permanent record, created and finalized in the same transaction as everything else
 * finalizeIdea() already does. Only cares whether the APPROVERS are tied — reviewers and
 * approvers act in parallel now, so reviewer completion has no bearing on whether a tie exists.
 */
async function submitTieBreak(idea, { decision, note, ownerId }, req) {
  if (idea.status !== 'under_review') {
    throw ApiError.badRequest('Reviews can only be submitted for an idea that is Under Review.');
  }
  if (req.user.roleName !== 'ceo' && !isSuperAdmin(req.user.permissions)) {
    throw ApiError.forbidden("You are not on this idea's review panel.");
  }
  if (decision === 'request_changes') {
    throw ApiError.badRequest('A tie-break must be approve or reject — there is no middle option.');
  }

  const allRows = await IdeaReview.findAll({ where: { ideaId: idea.id } });
  const approvers = allRows.filter((r) => r.kind === 'approver');
  if (approvers.length === 0 || approvers.some((r) => r.decision === null)) {
    throw ApiError.badRequest('Approvers have not all voted yet — there is nothing to break a tie on.');
  }
  const approveCount = approvers.filter((r) => r.decision === 'approve').length;
  const rejectCount = approvers.length - approveCount;
  if (approveCount !== rejectCount) {
    throw ApiError.badRequest("This idea's approvers are not tied — no tie-break is needed.");
  }

  return finalizeIdea(idea, {
    actingRow: null, actingRowIsNew: true, actingDecision: decision, note, ownerId, outcome: decision, reasonRows: allRows,
  }, req);
}

/**
 * The idea's terminal transition — the approver vote that completes a clear majority, or a CEO's
 * tie-break. `outcome` is the FINAL decided status, independent of `actingDecision` (the acting
 * row's own vote) — with 3+ approvers the completing voter's personal choice doesn't have to
 * match the majority they just completed. Writes the acting row (creating it, for a new
 * tie-breaker) INSIDE the same transaction as the status change (and, on approve, the
 * Application) — a verdict recorded for an idea that then fails to actually transition (e.g. a
 * missing ownerId) must never persist on its own; that's exactly what a naive write-then-validate
 * ordering would produce.
 */
async function finalizeIdea(idea, { actingRow, actingRowIsNew, actingDecision, note, ownerId, outcome, reasonRows }, req) {
  const toStatus = outcome === 'approve' ? 'approved' : 'rejected';
  const registersApplication = toStatus === 'approved' && idea.category === 'new_idea' && !idea.applicationId;
  if (registersApplication && !ownerId) {
    throw ApiError.badRequest('An Application owner (ownerId) is required to approve this idea.');
  }

  const fromStatus = idea.status;

  // Every participant's verdict, folded into the terminal transition's status_history note.
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

  let applicationId = idea.applicationId;

  await sequelize.transaction(async (t) => {
    if (actingRowIsNew) {
      await IdeaReview.create({
        ideaId: idea.id, userId: req.user.id, kind: 'tiebreaker', decision: actingDecision, note: note ?? null,
        addedBy: null, addedAt: new Date(),
      }, { transaction: t });
    } else {
      await actingRow.update({ decision: actingDecision, note: note ?? null }, { transaction: t });
    }

    if (registersApplication) {
      const ownerUser = await User.findByPk(ownerId, {
        include: [{ model: Role, as: 'role', include: [{ model: RolePermission, as: 'permissions' }] }],
        transaction: t,
      });
      if (!ownerUser || ownerUser.status !== 'active') {
        throw ApiError.badRequest('Application owner must be an existing, active user');
      }
      if (!isEligibleOwner(ownerUser)) {
        throw ApiError.badRequest('Application owner must have edit access to applications');
      }

      const app = await Application.create({
        name: idea.title,
        description: idea.description,
        departmentId: idea.departmentId,
        industry: idea.industry,
        functionalArea: idea.functionalArea,
        ownerId,
        status: 'planning',
        priority: idea.priority || 'medium',
        createdBy: req.user.id,
      }, { transaction: t });
      applicationId = app.id;
    }

    await idea.update({ status: toStatus, ...(applicationId !== idea.applicationId ? { applicationId } : {}) }, { transaction: t });

    await StatusHistory.create({
      entityType: 'idea', entityId: idea.id, fromStatus, toStatus, changedBy: req.user.id, note: finalNote,
    }, { transaction: t });
  });

  // On decided: notify the submitter, every participant, and the new Application owner — nothing
  // in between (see addParticipants' own "you were added" notification; no per-response pings).
  const recipients = [];
  if (idea.submittedBy !== req.user.id) {
    recipients.push({
      userId: idea.submittedBy, type: 'idea_status_change', title: 'Your idea status changed',
      message: `"${idea.title}" moved from ${fromStatus} to ${toStatus}.`, link: `/ideas/${idea.id}`,
    });
  }
  userIds.filter((uid) => uid !== req.user.id && uid !== idea.submittedBy).forEach((uid) => {
    recipients.push({
      userId: uid, type: 'idea_status_change', title: "An idea you're on the panel for was decided",
      message: `"${idea.title}" was ${toStatus === 'approved' ? 'approved' : 'rejected'}.`, link: `/ideas/${idea.id}`,
    });
  });
  if (registersApplication) {
    recipients.push({
      userId: ownerId, type: 'application_assigned', title: 'You were assigned an application',
      message: `"${idea.title}" was registered as an Application you own.`, link: `/applications/${applicationId}`,
    });
  }

  try {
    await notificationsService.createMany(recipients);
  } catch (err) {
    logger.error('Failed to create idea finalization notifications', {
      error: { message: err.message, stack: err.stack }, ideaId: idea.id,
    });
  }

  return getById(idea.id, req);
}

/**
 * Shadows base.getById. `req` is OPTIONAL — any future caller without one (a script/cron context)
 * gets the plain idea, no computed fields. Returns `panel` (see buildPanel) in place of the old
 * chain's `reviewChain`/`myChainSlot`/`chainComplete` — an idea's decided-ness is just
 * `idea.status` now, no separate boolean needed.
 */
async function getById(id, req) {
  const idea = await base.getById(id);
  if (!req?.user) return idea;

  const plain = idea.toJSON();
  const panel = await buildPanel(plain, req);

  return { ...plain, panel };
}

/**
 * Shadows base.list to add `awaitingMyReview=true`. A simple join: every under_review idea where
 * I have a panel row with no decision recorded yet — reviewer or approver, no distinction,
 * since the two act fully in parallel now and neither ever waits on the other. Panel membership
 * IS eligibility, so this is a single bulk query, not one per candidate idea.
 */
async function listAwaitingMyReview({ where, order, limit, offset, page }, req) {
  const myOpenIdeaIds = (await IdeaReview.findAll({
    where: { userId: req.user.id, decision: null }, attributes: ['ideaId'], raw: true,
  })).map((r) => r.ideaId);
  if (myOpenIdeaIds.length === 0) {
    return { items: [], pagination: buildPaginationMeta({ page, limit, count: 0 }) };
  }

  const { rows, count } = await Idea.findAndCountAll({
    where: { [Op.and]: [where, { status: 'under_review' }, { id: { [Op.in]: myOpenIdeaIds } }] },
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

  const { rows, count } = await Idea.findAndCountAll({
    where, order, limit, offset, include, distinct: true,
  });
  return { items: rows, pagination: buildPaginationMeta({ page, limit, count }) };
}

/**
 * Active users eligible to own a new Application — the same rule finalizeIdea()'s Application
 * registration enforces on whoever gets chosen, reused here so the owner picker in the
 * graduation dialog can't offer someone who'd then get rejected by that registration itself. Not
 * an approver-eligibility rule (see isEligibleOwner()'s own docstring) — an Employee approver can
 * still pick anyone eligible here as the owner, same as any other approver.
 */
async function eligibleOwners() {
  const users = await User.findAll({
    where: { status: 'active' },
    include: [{ model: Role, as: 'role', include: [{ model: RolePermission, as: 'permissions' }] }],
    attributes: ['id', 'name'],
    order: [['name', 'ASC']],
  });

  return users
    .filter((u) => isEligibleOwner(u))
    .map((u) => ({ id: u.id, name: u.name }));
}

async function statusHistory(id) {
  return StatusHistory.findAll({
    where: { entityType: 'idea', entityId: id },
    include: [{ model: User, as: 'changedByUser', attributes: ['id', 'name'] }],
    order: [['createdAt', 'ASC']],
  });
}

async function analytics() {
  const [mostPopular, mostReviewed, topContributors] = await Promise.all([
    Vote.findAll({
      attributes: ['entityId', [sequelize.fn('COUNT', sequelize.col('id')), 'voteCount']],
      where: { entityType: 'idea', voteType: 'upvote' },
      group: ['entityId'], order: [[sequelize.literal('"voteCount"'), 'DESC']], limit: 5, raw: true,
    }),
    Comment.findAll({
      attributes: ['entityId', [sequelize.fn('COUNT', sequelize.col('id')), 'commentCount']],
      where: { entityType: 'idea' },
      group: ['entityId'], order: [[sequelize.literal('"commentCount"'), 'DESC']], limit: 5, raw: true,
    }),
    Idea.findAll({
      attributes: ['submittedBy', [sequelize.fn('COUNT', sequelize.col('Idea.id')), 'ideaCount']],
      group: ['submittedBy', 'submitter.id'], order: [[sequelize.literal('"ideaCount"'), 'DESC']], limit: 5,
      include: [{ model: User, as: 'submitter', attributes: ['id', 'name', 'avatarUrl'] }],
    }),
  ]);

  const ideaIds = [...mostPopular.map((r) => r.entityId), ...mostReviewed.map((r) => r.entityId)];
  const ideas = await Idea.findAll({ where: { id: ideaIds }, attributes: ['id', 'title', 'status'] });
  const ideaById = new Map(ideas.map((i) => [i.id, i]));

  return {
    mostPopular: mostPopular.map((r) => ({ idea: ideaById.get(r.entityId), voteCount: Number(r.voteCount) })),
    mostReviewed: mostReviewed.map((r) => ({ idea: ideaById.get(r.entityId), commentCount: Number(r.commentCount) })),
    topContributors: topContributors.map((r) => ({ submitter: r.submitter, ideaCount: Number(r.get('ideaCount')) })),
  };
}

module.exports = {
  ...base, create, update, remove, statusHistory, analytics, getById, list, eligibleOwners,
  submitReview, addParticipants, removeParticipant, panelCandidates,
};

const { Op } = require('sequelize');
const { User, Role } = require('../models');

// The review panel's three slots, in display order. Shared by Ideas (idea_reviews) and Suggestions
// (suggestion_reviews) — one review row per (entity, role), UNIQUE per their own migration.
const REVIEW_SLOTS = ['team_lead', 'manager', 'ceo'];

// req.user carries no label, and querying `roles` on every transition to render a string that only
// changes when someone edits the seeder isn't worth it — mirrors seeders/20260101000001-roles.js.
const ROLE_LABELS = {
  admin: 'Admin', ceo: 'CEO', manager: 'Manager', team_lead: 'Team Lead', employee: 'Employee',
};

// The position/role-pair half of a panel-role badge, e.g. "Reviewer · Team Lead" — mirrors Ideas'
// own REVIEWER_LABELS (ideas.constants.js) byte-for-byte. Team Lead and Manager share the plain
// "Reviewer" label since the panel is unordered between them; CEO keeps a distinct label since
// their vote is the one that actually finalizes the suggestion. Consumed by buildReviewPanel below
// so CommentThread's showRoleBadges can render a panel-role badge on a Suggestion's comments the
// same way it does on an Idea's.
const REVIEWER_LABELS = {
  team_lead: 'Reviewer',
  manager: 'Reviewer',
  ceo: 'Final Decision',
};

/**
 * Active users eligible for a specific review-panel ROLE on a given entity (an Idea or a
 * Suggestion — anything with `functionalArea`), matched purely on functional area — department is
 * NOT a routing signal (it stays a display/org-chart field on the entity, just doesn't drive who
 * can review it). `ceo` is never functional-area-matched — always every active CEO, org-wide (in
 * practice there's normally exactly one). Falls back to every active holder of the role if nobody
 * holds the entity's functional area — an entity must never become unreviewable. Returns
 * `usedFallback` so callers (and eventually the UI) can say when the fallback fired.
 *
 * By convention (enforced in users.service.js, not the DB) a functional area has at most one
 * active Team Lead and one active Manager, so the non-fallback case should normally resolve to
 * exactly one person — this does NOT hard-assume that; it still works correctly (just returns
 * however many actually matched) if that convention is ever violated.
 */
async function eligibleReviewers(entity, roleName) {
  const roleInclude = { model: Role, as: 'role', where: { name: roleName } };
  const toUsers = (list) => list.map((u) => ({ id: u.id, name: u.name }));

  if (roleName === 'ceo') {
    const users = await User.findAll({
      where: { status: 'active' }, include: [roleInclude], attributes: ['id', 'name'], order: [['name', 'ASC']],
    });
    return { users: toUsers(users), usedFallback: false };
  }

  if (entity.functionalArea) {
    const matched = await User.findAll({
      where: { status: 'active', functionalAreas: { [Op.contains]: [entity.functionalArea] } },
      include: [roleInclude], attributes: ['id', 'name'], order: [['name', 'ASC']],
    });
    if (matched.length > 0) return { users: toUsers(matched), usedFallback: false };
  }

  const fallback = await User.findAll({
    where: { status: 'active' }, include: [roleInclude], attributes: ['id', 'name'], order: [['name', 'ASC']],
  });
  return { users: toUsers(fallback), usedFallback: true };
}

/**
 * Batched form of eligibleReviewers() for MULTIPLE roles at once — see eligibleReviewers' own
 * docstring for the matching rule. Batches to at most 3 queries total regardless of how many roles
 * are requested: one functional-area-matched query covering every non-CEO role at once, one
 * fallback query covering only the roles that came back empty from that, and one org-wide CEO
 * query if 'ceo' was requested. Results are partitioned back out in memory.
 *
 * Returns a Map<roleName, { users, usedFallback }> — same per-role shape eligibleReviewers()
 * returns for a single role, so callers can treat entries interchangeably with it.
 */
async function eligibleReviewersForRoles(entity, roleNames) {
  const result = new Map();
  const toUsers = (list) => list.map((u) => ({ id: u.id, name: u.name }));

  if (roleNames.includes('ceo')) {
    const ceoUsers = await User.findAll({
      where: { status: 'active' },
      include: [{ model: Role, as: 'role', where: { name: 'ceo' } }],
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });
    result.set('ceo', { users: toUsers(ceoUsers), usedFallback: false });
  }

  const nonCeoRoles = roleNames.filter((r) => r !== 'ceo');
  if (nonCeoRoles.length === 0) return result;

  const matched = entity.functionalArea ? await User.findAll({
    where: { status: 'active', functionalAreas: { [Op.contains]: [entity.functionalArea] } },
    include: [{ model: Role, as: 'role', where: { name: { [Op.in]: nonCeoRoles } } }],
    attributes: ['id', 'name'],
    order: [['name', 'ASC']],
  }) : [];

  const matchedByRole = new Map(nonCeoRoles.map((r) => [r, []]));
  matched.forEach((u) => matchedByRole.get(u.role.name).push(u));

  const needsFallback = nonCeoRoles.filter((r) => matchedByRole.get(r).length === 0);
  const fallbackByRole = new Map(needsFallback.map((r) => [r, []]));
  if (needsFallback.length > 0) {
    const fallback = await User.findAll({
      where: { status: 'active' },
      include: [{ model: Role, as: 'role', where: { name: { [Op.in]: needsFallback } } }],
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });
    fallback.forEach((u) => fallbackByRole.get(u.role.name).push(u));
  }

  nonCeoRoles.forEach((role) => {
    const roleMatched = matchedByRole.get(role);
    if (roleMatched.length > 0) {
      result.set(role, { users: toUsers(roleMatched), usedFallback: false });
    } else {
      result.set(role, { users: toUsers(fallbackByRole.get(role)), usedFallback: true });
    }
  });

  return result;
}

/**
 * Builds the review-panel view for an entity (an Idea or a Suggestion): one entry per panel role
 * (REVIEW_SLOTS), merging any recorded review-row decision with live eligibility data.
 * `candidatesByRole` is null for a non-live panel (the entity isn't currently at its panel status)
 * — eligibility is only meaningful while voting is actually open, so a historical panel just shows
 * what was decided, with usedFallback reported as null rather than a stale/misleading true-or-false.
 */
async function buildReviewPanel({ ReviewModel, entityIdField, entityId, candidatesByRole }) {
  const reviews = await ReviewModel.findAll({
    where: { [entityIdField]: entityId },
    include: [{ model: User, as: 'reviewer', attributes: ['id', 'name'] }],
  });
  const byRole = new Map(reviews.map((r) => [r.roleName, r]));

  const slots = REVIEW_SLOTS.map((roleName) => {
    const review = byRole.get(roleName);
    return {
      roleName,
      roleLabel: ROLE_LABELS[roleName] || roleName,
      reviewerLabel: REVIEWER_LABELS[roleName] || roleName,
      decision: review?.decision ?? null,
      note: review?.note ?? null,
      reviewer: review?.reviewer ? { id: review.reviewer.id, name: review.reviewer.name } : null,
      reviewedAt: review?.updatedAt ?? null,
      usedFallback: candidatesByRole ? (candidatesByRole.get(roleName)?.usedFallback ?? null) : null,
    };
  });

  const panelComplete = ['team_lead', 'manager'].every((roleName) => byRole.has(roleName));

  return { slots, panelComplete };
}

/** Null unless the viewer's own role is a panel slot AND the panel is currently live. */
function buildMyReviewSlot(user, candidatesByRole, slots) {
  if (!candidatesByRole || !REVIEW_SLOTS.includes(user.roleName)) return null;
  const mySlot = slots.find((s) => s.roleName === user.roleName);
  const eligible = (candidatesByRole.get(user.roleName)?.users || []).some((u) => u.id === user.id);
  return {
    roleName: user.roleName,
    decision: mySlot?.decision ?? null,
    note: mySlot?.note ?? null,
    eligible,
  };
}

module.exports = {
  REVIEW_SLOTS, ROLE_LABELS, REVIEWER_LABELS, eligibleReviewers, eligibleReviewersForRoles, buildReviewPanel, buildMyReviewSlot,
};

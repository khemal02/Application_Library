/**
 * Which `roles.name` values may move a suggestion OUT of each status — matched purely on
 * functional area (see utils/reviewPanel.js#eligibleReviewers; department is NOT a routing signal,
 * just a display/org-chart field), with an org-wide fallback if nobody holds that functional area.
 * `technical_review` is the review panel (team_lead/manager/ceo — see suggestion_reviews):
 * team_lead and manager vote independently of each other, and ceo is gated on BOTH of them being
 * done — mirrors Ideas' PARALLEL_ROLES/TERMINAL_ROLE model exactly (see ideas.constants.js).
 * `submitted` (single team_lead claim into the panel) is a single-owner claim.
 *
 * `discussion` is RETIRED — it used to be where a request_changes verdict sent a suggestion back
 * to (re-promoted into technical_review by team_lead), but request_changes is gone now that ceo's
 * decision is binding and terminal like Ideas'. No live suggestion is ever AT discussion again;
 * `status_history` rows from before this change may still reference it (see
 * SUGGESTION_STATUS_LABELS below, which keeps the label forever for exactly that reason).
 *
 * `approved`, `assigned`, `implemented`, `closed`, and `rejected` are deliberately ABSENT — these
 * are execution/fulfillment steps (assign to an implementer, mark implemented, close it out), not
 * review steps, and keep working exactly as before this panel existed: gated only by the flat
 * `suggestions:review` permission, no functional-area matching. A status missing from this map is
 * NOT locked down (unlike Ideas' stageOwnerAllows, which treats an unmapped status as admin-only)
 * — see suggestions.service.js#stageOwnerAllows for why the two modules' fallthrough differs.
 */
const SUGGESTION_STAGE_OWNERS = {
  submitted: ['team_lead'],
  technical_review: ['team_lead', 'manager', 'ceo'],
};

// REVIEW_SLOTS/ROLE_LABELS are shared with Ideas' own review panel (idea_reviews) — defined once
// in utils/reviewPanel.js.
const { REVIEW_SLOTS, ROLE_LABELS } = require('../../utils/reviewPanel');

// Display names for the stage-owner forbidden-message ("...out of Technical Review"). Mirrored in
// frontend/src/constants/options.js (SUGGESTION_STATUS_LABELS) so the API's 403 messages and the
// UI name stages identically. `discussion` stays forever even though it's retired (see
// SUGGESTION_STAGE_OWNERS above) — old status_history rows can still reference it and must keep
// rendering a real label, not a blank one; mirrors ideas.constants.js#IDEA_STATUS_LABELS.
const SUGGESTION_STATUS_LABELS = {
  submitted: 'Submitted',
  technical_review: 'Technical Review',
  discussion: 'Discussion',
  approved: 'Approved',
  assigned: 'Assigned',
  implemented: 'Implemented',
  closed: 'Closed',
  rejected: 'Rejected',
};

module.exports = {
  SUGGESTION_STAGE_OWNERS, ROLE_LABELS, SUGGESTION_STATUS_LABELS, REVIEW_SLOTS,
};

// The fixed team_lead -> manager -> ceo chain (REVIEW_CHAIN/PARALLEL_ROLES/TERMINAL_ROLE,
// computeReviewState) is gone — see 20260130000026-idea-panel-participants.js and
// ideas.service.js. Each idea now carries an open panel the submitter (or a CEO/Admin) composes:
// any number of REVIEWERS (advisory — their verdict is recorded and visible but never moves the
// idea) and any number of APPROVERS, who decide it by majority once every approver has voted (a
// tie is broken by any active CEO — see ideas.service.js#submitTieBreak). There is no ordering
// between people of the same kind, and eligibility for EITHER kind is just "any active user" —
// an Employee can approve. Only the separate question of who may own the Application an approval
// registers keeps its own applications:update/manage requirement (see
// ideas.service.js#isEligibleOwner).
const PANEL_KINDS = ['reviewer', 'approver'];

// ROLE_LABELS is shared with Suggestions' own review panel — defined once in utils/reviewPanel.js,
// re-exported here so existing imports of this module don't need to change. Still used here for
// display (e.g. naming a panel member's actual role), even though role no longer decides panel
// membership the way it did under the old chain.
const { ROLE_LABELS } = require('../../utils/reviewPanel');

// Display names for historical status_history rendering. submitted, technical_review_1/2 and
// review were retired earlier (collapsed into under_review); discussion and development_ready are
// retired by this phase (discussion is no longer a live gate — ideas are created directly at
// under_review; development_ready is retired outright, folded into approved). None of these five
// keys is ever a live idea's CURRENT status again, but every one stays here forever — status_history
// rows from before each respective migration still reference them and must keep rendering a real
// label, not a blank string. Do NOT derive a "what can I filter by" list from this object's keys —
// see IDEA_STATUS_OPTIONS on the frontend, which learned that lesson the hard way (Phase 3).
const IDEA_STATUS_LABELS = {
  submitted: 'Submitted',
  discussion: 'Discussion',
  technical_review_1: 'Team Lead Review',
  technical_review_2: 'Manager Review',
  review: 'CEO Approval',
  under_review: 'Under Review',
  approved: 'Approved',
  development_ready: 'Development Ready',
  rejected: 'Rejected',
};

module.exports = {
  PANEL_KINDS, ROLE_LABELS, IDEA_STATUS_LABELS,
};

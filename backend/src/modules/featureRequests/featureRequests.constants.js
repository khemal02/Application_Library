// Forked from ideas.constants.js as part of the Ideas/Feature-Requests split — see
// 20260130000035-split-feature-requests-from-ideas.js. The panel model (any number of REVIEWERS,
// advisory; any number of APPROVERS, majority-decides, tie broken by any active CEO) is identical
// to Ideas' — see featureRequests.service.js for the full rule set.
const PANEL_KINDS = ['reviewer', 'approver'];

// Shared with Ideas and Suggestions' own review panels — defined once in utils/reviewPanel.js.
const { ROLE_LABELS } = require('../../utils/reviewPanel');

// Unlike IDEA_STATUS_LABELS, this table never carried any retired stage-machine statuses — it
// only ever existed under the open-panel model — so there's nothing historical to keep around.
const FEATURE_REQUEST_STATUS_LABELS = {
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

module.exports = {
  PANEL_KINDS, ROLE_LABELS, FEATURE_REQUEST_STATUS_LABELS,
};

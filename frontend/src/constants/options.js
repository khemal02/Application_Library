import humanize from '../utils/humanize';

const toOptions = (values) => values.map((value) => ({ value, label: humanize(value) }));

export const PRIORITY_OPTIONS = toOptions(['low', 'medium', 'high', 'critical']);
export const SEVERITY_OPTIONS = toOptions(['low', 'medium', 'high', 'critical']);
export const COMPLEXITY_OPTIONS = toOptions(['low', 'medium', 'high']);

export const APPLICATION_STATUS_OPTIONS = toOptions(['development', 'testing', 'deployment']);
export const FEATURE_STATUS_OPTIONS = toOptions(['planned', 'in_progress', 'completed', 'blocked']);
export const BUG_STATUS_OPTIONS = toOptions(['open', 'in_progress', 'resolved', 'wont_fix']);
export const KNOWN_ISSUE_STATUS_OPTIONS = toOptions(['active', 'monitoring', 'resolved']);
export const ROADMAP_STATUS_OPTIONS = toOptions(['proposed', 'planned', 'in_progress', 'done']);
export const TIMELINE_STATUS_OPTIONS = toOptions(['upcoming', 'in_progress', 'completed', 'delayed']);
export const CHANGE_REQUEST_STATUS_OPTIONS = toOptions(['pending', 'in_review', 'approved', 'rejected', 'implemented']);
// Role-based display names for the Ideas workflow stages — the enum values (used everywhere else:
// TRANSITIONS, status_history rows, StatusBadge's COLOR_MAP keys) never change, only what's printed.
// Mirrored verbatim in backend/src/modules/ideas/ideas.constants.js so the API's 403 messages and
// the UI name stages identically. Not applied to Suggestions — that workflow keeps humanize().
// technical_review_1/2 and review are RETIRED (collapsed into under_review, a parallel review
// panel) — no idea's current status is ever one of them again, but status_history rows from
// before this phase still reference them and must keep rendering a real label, not a blank one.
export const IDEA_STATUS_LABELS = {
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
export function ideaStatusLabel(status) {
  return IDEA_STATUS_LABELS[status] || humanize(status);
}

// Filter options must be a status an idea can actually BE at right now — NOT every key
// IDEA_STATUS_LABELS happens to know how to render. submitted/discussion/technical_review_1/
// technical_review_2/review/development_ready are all historical-only since the three-reviewer
// chain replaced the old stage machine: real rows in status_history still reference them, but no
// idea's CURRENT status is ever one of them again, so offering them as a filter is guaranteed to
// return zero rows. The chain has exactly one live status (under_review) and two terminal ones.
const LIVE_IDEA_STATUSES = ['under_review', 'approved', 'rejected'];
export const IDEA_STATUS_OPTIONS = LIVE_IDEA_STATUSES.map((value) => ({ value, label: ideaStatusLabel(value) }));
// 'discussion' is retired — request_changes (the only thing that ever led there) is gone now that
// the ceo's decision is binding and terminal, same as Ideas' — see suggestions.constants.js. Old
// status_history rows may still reference it (humanize('discussion') renders it fine there), but
// no suggestion's CURRENT status is ever discussion again, so it's dropped from this filter list —
// same reasoning as IDEA_STATUS_OPTIONS above.
export const SUGGESTION_STATUS_OPTIONS = toOptions(['submitted', 'technical_review', 'approved', 'assigned', 'implemented', 'closed', 'rejected']);
export const TECH_STACK_CATEGORY_OPTIONS = toOptions(['frontend', 'backend', 'database', 'ai_model', 'framework', 'library', 'cloud', 'devops']);
export const API_METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((value) => ({ value, label: value }));

export const INDUSTRY_OPTIONS = toOptions([
  'technology', 'financial_services', 'healthcare', 'retail', 'manufacturing', 'public_sector',
  'energy_utilities', 'consumer_products', 'life_sciences', 'telecommunications', 'other',
]);
export const FUNCTIONAL_AREA_OPTIONS = toOptions([
  'finance', 'procurement', 'sales_distribution', 'supply_chain', 'human_resources',
  'manufacturing_production', 'quality_management', 'plant_maintenance', 'project_systems',
  'customer_service', 'information_technology', 'analytics_reporting', 'other',
]);

export const SUGGESTION_WORKFLOW_STEPS = ['submitted', 'technical_review', 'approved', 'assigned', 'implemented', 'closed'];
// Which transitions are actually available from the current status now comes from the server
// (suggestion.availableTransitions, computed per-viewer — see suggestions.service.js#getById). A
// client-side copy of the transition graph (formerly SUGGESTION_TRANSITIONS here) silently went
// stale once the backend gained department/functional-area-matched panel gating at
// technical_review. Ideas moved off this workflow-stepper model entirely in favor of an open
// review panel — see pages/Ideas/IdeaPanelCard.jsx — so it has no equivalent constant here
// anymore.

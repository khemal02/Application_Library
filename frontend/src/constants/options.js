import humanize from '../utils/humanize';

const toOptions = (values) => values.map((value) => ({ value, label: humanize(value) }));

export const PRIORITY_OPTIONS = toOptions(['low', 'medium', 'high', 'critical']);
export const SEVERITY_OPTIONS = toOptions(['low', 'medium', 'high', 'critical']);
export const COMPLEXITY_OPTIONS = toOptions(['low', 'medium', 'high']);

// 'deployment' is the terminal status — an Application that's shipped and in production, not one
// still mid-rollout — so it reads as "Live" everywhere a status is shown, even though the enum
// value itself (used in filters, the edit form, TRANSITIONS) stays 'deployment'. Same
// value-vs-label split as IDEA_STATUS_LABELS/ideaStatusLabel above.
export const APPLICATION_STATUS_LABELS = { development: 'Development', testing: 'Testing', deployment: 'Live' };
export function applicationStatusLabel(status) {
  return APPLICATION_STATUS_LABELS[status] || humanize(status);
}
export const APPLICATION_STATUS_OPTIONS = ['development', 'testing', 'deployment']
  .map((value) => ({ value, label: applicationStatusLabel(value) }));
export const FEATURE_STATUS_OPTIONS = toOptions(['planned', 'in_progress', 'completed', 'blocked']);
export const BUG_STATUS_OPTIONS = toOptions(['open', 'in_progress', 'resolved', 'wont_fix']);
export const KNOWN_ISSUE_STATUS_OPTIONS = toOptions(['active', 'monitoring', 'resolved']);
export const ROADMAP_STATUS_OPTIONS = toOptions(['proposed', 'planned', 'in_progress', 'done']);
export const TIMELINE_STATUS_OPTIONS = toOptions(['upcoming', 'in_progress', 'completed', 'delayed']);
export const CHANGE_REQUEST_STATUS_OPTIONS = toOptions(['pending', 'in_review', 'approved', 'rejected', 'implemented']);
// Role-based display names for the Ideas workflow stages — the enum values (used everywhere else:
// TRANSITIONS, status_history rows, StatusBadge's COLOR_MAP keys) never change, only what's printed.
// Mirrored verbatim in backend/src/modules/ideas/ideas.constants.js so the API's 403 messages and
// the UI name stages identically.
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

// Shared by ApplicationTrackingListPage.jsx and (Stage 4) ApplicationTrackingDetailPage.jsx — same
// reasoning changeRequestStatus.js already documents: the list row and the detail header must
// never disagree about what a track's status chip reads, so the derivation lives in one place.
export const STAGE_ORDER = ['development', 'testing', 'deployment'];
export const STAGE_LABELS = {
  development: 'Development', testing: 'Testing', deployment: 'Deployment',
};
export const STAGE_STATUS_LABELS = { not_started: 'Not started', in_progress: 'In progress', complete: 'Completed' };

function stageRow(track, stage) {
  return track.stages?.find((s) => s.stage === stage) || { stage, status: 'not_started' };
}

/**
 * `status` is a lifecycle, not a duplicate of the stages (1b) — 'active' means "read the stages to
 * know where it's got to"; the other three override that entirely. Mirrors
 * changeRequestStatus.js#deriveStatusChip's shape.
 */
export function deriveStatusChip(track) {
  if (track.status === 'on_hold') return { color: 'warning', label: 'On hold' };
  if (track.status === 'cancelled') return { color: 'default', label: 'Cancelled' };
  if (track.status === 'live') return { color: 'success', label: 'Live' };

  const stages = STAGE_ORDER.map((s) => stageRow(track, s));
  const inProgress = stages.find((s) => s.status === 'in_progress');
  if (inProgress) return { color: 'info', label: `In ${STAGE_LABELS[inProgress.stage]}` };

  const anyStarted = stages.some((s) => s.status !== 'not_started');
  if (!anyStarted) return { color: 'default', label: 'Not started' };

  const lastCompleted = [...STAGE_ORDER].reverse().find((s) => stageRow(track, s).status === 'complete');
  return lastCompleted ? { color: 'info', label: `${STAGE_LABELS[lastCompleted]} completed` } : { color: 'default', label: 'Not started' };
}

/** The Stage column's text — named explicitly so the current stage never depends on color alone. */
export function currentStageLabel(track) {
  const stages = STAGE_ORDER.map((s) => stageRow(track, s));
  const currentIndex = stages.findIndex((s) => s.status !== 'complete');
  return currentIndex === -1 ? 'Completed' : STAGE_LABELS[STAGE_ORDER[currentIndex]];
}

/** Four pips for the Progress column: complete / current (first non-complete) / upcoming. */
export function stagePips(track) {
  const stages = STAGE_ORDER.map((s) => stageRow(track, s));
  const currentIndex = stages.findIndex((s) => s.status !== 'complete');
  return stages.map((s, i) => ({
    stage: s.stage,
    pipState: s.status === 'complete' ? 'complete' : i === currentIndex ? 'current' : 'upcoming',
  }));
}

/** Who's actually got the ball right now — the current stage's assignee, if the track has one. */
export function currentAssignee(track) {
  const stages = STAGE_ORDER.map((s) => stageRow(track, s));
  const currentIndex = stages.findIndex((s) => s.status !== 'complete');
  if (currentIndex === -1) return null;
  return stages[currentIndex].assignee || null;
}

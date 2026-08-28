// Shared by ChangeRequestsCard.jsx and ChangeRequestDetailPage.jsx — the header chip on the detail
// screen and the card's row chip must always agree (completing Development alone changes both),
// so this lives in one place rather than two copies that could quietly drift apart.
export const STAGE_ORDER = ['development', 'testing', 'deployment'];
export const STAGE_LABELS = { development: 'Development', testing: 'Testing', deployment: 'Deployment' };
export const STAGE_STATUS_LABELS = { not_started: 'Not started', in_progress: 'In progress', complete: 'Complete' };

/**
 * The chip reads the delivery pipeline, not just `status` — `status` alone can't tell "approved,
 * nothing started" from "approved, deployment complete", and that distinction is the whole point
 * of both surfaces that use this. Explicit `color` (StatusBadge's own prop, not a COLOR_MAP value)
 * — none of these labels are any one field's real value, so borrowing an unrelated map entry just
 * to steal its tint would silently couple "Not started"'s colour to some other status's meaning.
 */
export function deriveStatusChip(cr) {
  if (cr.status === 'pending') return { color: 'default', label: 'Pending' };
  if (cr.status === 'in_review') return { color: 'default', label: 'In review' };
  if (cr.status === 'rejected') return { color: 'error', label: 'Rejected' };
  if (cr.status === 'implemented') return { color: 'success', label: 'Implemented' };

  // approved from here on
  const stages = cr.stages || [];
  const inProgress = stages.find((s) => s.status === 'in_progress');
  if (inProgress) return { color: 'info', label: `In ${STAGE_LABELS[inProgress.stage]}` };

  const anyStarted = stages.some((s) => s.status !== 'not_started');
  if (!anyStarted) return { color: 'default', label: 'Not started' };

  const lastCompleted = [...STAGE_ORDER].reverse()
    .find((stage) => stages.find((s) => s.stage === stage)?.status === 'complete');
  return lastCompleted
    ? { color: 'info', label: `${STAGE_LABELS[lastCompleted]} complete` }
    : { color: 'default', label: 'Not started' };
}

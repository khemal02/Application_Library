import { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { alpha } from '@mui/material/styles';
import dayjs from 'dayjs';
import { applicationTrackingApi, commentsApi } from '../../services/domains';
import { useAppSelector } from '../../app/hooks';
import useResource from '../../hooks/useResource';
import useBreadcrumbLabel from '../../hooks/useBreadcrumbLabel';
import useToast from '../../hooks/useToast';
import usePermission from '../../routes/usePermission';
import { LoadingBlock, ErrorBlock } from '../../components/common/AsyncState';
import StatusBadge from '../../components/common/StatusBadge';
import BackButton from '../../components/common/BackButton';
import NotesThread from '../../components/common/NotesThread';
import AttachmentsPanel from '../../components/common/AttachmentsPanel';
import {
  STAGE_ORDER, STAGE_LABELS, STAGE_STATUS_LABELS, deriveStatusChip,
} from '../../utils/applicationTrackStatus';

const formatDate = (value) => (value ? dayjs(value).format('MMM D, YYYY') : '—');

const NOTES_CANCELLED_REASON = 'This track was cancelled — its stages are no longer open for notes.';

const CAPTION_SX = {
  display: 'block', textTransform: 'uppercase', letterSpacing: '.07em', color: 'text.disabled',
};

const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Critical', description: 'A commitment with a date attached; slipping it costs something real.', color: 'error' },
  { value: 'high', label: 'High', description: 'Wanted this quarter; someone is waiting and has been told roughly when.', color: 'warning' },
  { value: 'medium', label: 'Medium', description: 'Approved and worth doing; no date promised.', color: null },
  { value: 'low', label: 'Low', description: 'Good idea, no urgency; picked up when there is room.', color: null },
];
const PRIORITY_META = Object.fromEntries(PRIORITY_OPTIONS.map((o) => [o.value, o]));

function PriorityChip({ priority }) {
  const meta = PRIORITY_META[priority] || PRIORITY_META.medium;
  return <Chip size="small" variant="outlined" color={meta.color || 'default'} label={meta.label} />;
}

function ReadField({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" sx={CAPTION_SX}>{label}</Typography>
      <Typography variant="body2" color={value ? 'text.primary' : 'text.disabled'} sx={{ mt: 0.25 }}>
        {value || '—'}
      </Typography>
    </Box>
  );
}

/**
 * Four described option cards, not a dropdown — same reasoning the Issues card's severity picker
 * used before it was changed to a dropdown at the user's request for THAT form specifically; here
 * the RICC is explicit the opposite way ("a dropdown of four bare words makes everything High").
 */
function PriorityDialog({
  open, currentPriority, onClose, onSubmit,
}) {
  const [selected, setSelected] = useState(currentPriority);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { if (open) { setSelected(currentPriority); setError(null); } }, [open, currentPriority]);

  const handleSubmit = async () => {
    if (selected === currentPriority) { onClose(); return; }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(selected);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change priority');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !submitting && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>Change priority</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Grid container spacing={1} sx={{ mt: 0.5 }}>
          {PRIORITY_OPTIONS.map((opt) => {
            const isSelected = selected === opt.value;
            return (
              <Grid item xs={12} sm={6} key={opt.value}>
                <Box
                  role="button" tabIndex={0}
                  onClick={() => setSelected(opt.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(opt.value); } }}
                  sx={(theme) => ({
                    p: 1.5, borderRadius: 1, cursor: 'pointer', height: '100%',
                    border: 1,
                    borderColor: isSelected ? (opt.color ? `${opt.color}.main` : 'text.secondary') : 'divider',
                    bgcolor: isSelected ? (opt.color ? alpha(theme.palette[opt.color].main, 0.08) : theme.palette.action.selected) : 'transparent',
                    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '-2px' },
                  })}
                >
                  <Typography variant="body2" fontWeight={700}>{opt.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{opt.description}</Typography>
                </Box>
              </Grid>
            );
          })}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="contained" disabled={submitting || selected === currentPriority} onClick={handleSubmit}>
          {submitting ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Shared by "Put on hold" and "Cancel" — both require a reason (1c: holdBody/cancelBody). */
function ReasonDialog({
  open, title, copy, submitLabel, danger, onClose, onSubmit,
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { if (open) { setReason(''); setError(null); } }, [open]);

  const handleSubmit = async () => {
    if (!reason.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(reason.trim());
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !submitting && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {copy && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{copy}</Typography>}
        <TextField
          autoFocus fullWidth multiline minRows={3} label="Reason" required value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="contained" color={danger ? 'error' : 'primary'} disabled={!reason.trim() || submitting} onClick={handleSubmit}>
          {submitting ? 'Saving...' : submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Mark-complete confirmation — same shape as ChangeRequestDetailPage.jsx's MarkCompleteDialog. */
function MarkCompleteDialog({
  open, stage, isLastStage, onClose, onConfirm, submitting,
}) {
  const [note, setNote] = useState('');
  useEffect(() => { if (open) setNote(''); }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Mark {stage && STAGE_LABELS[stage]} complete?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {isLastStage
            ? "This notifies the track's owner — they'll then move it to the Applications catalogue to close it as Live."
            : `${stage && STAGE_LABELS[STAGE_ORDER[STAGE_ORDER.indexOf(stage) + 1]]} is next.`}
        </Typography>
        <TextField
          fullWidth multiline minRows={3} label="Note (optional)"
          value={note} onChange={(e) => setNote(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="contained" disabled={submitting} onClick={() => onConfirm(note.trim())}>Mark complete</Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * One of the four stacked sections — the three modes are the whole point of this component:
 *   complete    -> plain text, no inputs
 *   in_progress -> editable date inputs + Save/Mark complete (only if canAct)
 *   not_started -> inputs rendered but disabled, plus one line saying what's waited on
 * Never a disabled action BUTTON (1c/Stage 4 style rule) — canAct=false renders zero buttons, in
 * any mode, rather than greying them out. Assignee is display-only here — reassignment is done
 * from the AssignCard in the sticky rail, same split ChangeRequestDetailPage.jsx uses.
 *
 * The chip is assignee-aware, same as ChangeRequestDetailPage.jsx's StageCard: the person actually
 * assigned to THIS stage sees "Your turn" / "Waiting on {predecessor's assignee}" instead of the
 * generic Not started/In progress/Complete label — everyone else still sees the generic one.
 */
function StageSection({
  stage, stageData, canAct, canWriteNotes, isBlockedByPredecessor, predecessorLabel, predecessorAssigneeName,
  isViewerStage, isRequestReady, trackStatus, onStart, onSaveDates, onOpenComplete, submitting,
}) {
  const isComplete = stageData.status === 'complete';
  const isInProgress = stageData.status === 'in_progress';
  const editable = isInProgress && canAct;

  const [startDraft, setStartDraft] = useState(stageData.startDate || '');
  const [endDraft, setEndDraft] = useState(stageData.endDate || '');
  const [linkDraft, setLinkDraft] = useState(stageData.documentUrl || '');
  useEffect(() => {
    setStartDraft(stageData.startDate || '');
    setEndDraft(stageData.endDate || '');
    setLinkDraft(stageData.documentUrl || '');
  }, [stageData.startDate, stageData.endDate, stageData.documentUrl]);

  const dirty = editable && (
    startDraft !== (stageData.startDate || '')
    || endDraft !== (stageData.endDate || '')
    || linkDraft.trim() !== (stageData.documentUrl || '')
  );

  let chip;
  if (isViewerStage && !isComplete) {
    const actionableNow = isInProgress || !isBlockedByPredecessor;
    chip = actionableNow
      ? { color: 'info', label: 'Your turn' }
      : { color: 'warning', label: `Waiting on ${predecessorAssigneeName || 'someone'}` };
  } else {
    chip = {
      color: isComplete ? 'success' : isInProgress ? 'info' : 'default',
      label: STAGE_STATUS_LABELS[stageData.status],
    };
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1" fontWeight={700}>
          {STAGE_LABELS[stage]}{isViewerStage ? ' — you' : ''}
        </Typography>
        <StatusBadge color={chip.color} label={chip.label} />
      </Stack>

      <Grid container spacing={2} sx={{ mt: 0.5, mb: 2 }}>
        <Grid item xs={6} sm={3}>
          <ReadField label="Assignee" value={stageData.assignee?.name} />
        </Grid>
        <Grid item xs={6} sm={3}>
          {isComplete ? (
            <ReadField label="Started" value={formatDate(stageData.startDate)} />
          ) : (
            <TextField
              fullWidth size="small" label="Started" type="date" InputLabelProps={{ shrink: true }}
              value={startDraft} disabled={!editable}
              onChange={(e) => setStartDraft(e.target.value)}
            />
          )}
        </Grid>
        <Grid item xs={6} sm={3}>
          {isComplete ? (
            <ReadField label="Expected finish" value={formatDate(stageData.endDate)} />
          ) : (
            <TextField
              fullWidth size="small" label="Expected finish" type="date" InputLabelProps={{ shrink: true }}
              value={endDraft} disabled={!editable}
              onChange={(e) => setEndDraft(e.target.value)}
            />
          )}
        </Grid>
        <Grid item xs={6} sm={3}>
          {isComplete ? (
            <ReadField
              label="Document link"
              value={stageData.documentUrl ? (
                <Link href={stageData.documentUrl} target="_blank" rel="noopener noreferrer">{stageData.documentUrl}</Link>
              ) : null}
            />
          ) : (
            <TextField
              fullWidth size="small" label="Document link" placeholder="https://..." type="url"
              InputLabelProps={{ shrink: true }}
              value={linkDraft} disabled={!editable}
              onChange={(e) => setLinkDraft(e.target.value)}
            />
          )}
        </Grid>
      </Grid>

      <AttachmentsPanel
        entityType="application_track_stage" entityId={stageData.id}
        accept="image/*" label="Screenshots" disabled={!canWriteNotes || trackStatus === 'cancelled'}
      />

      <Box sx={{ mt: 2 }}>
        <NotesThread
          entityType="application_track_stage"
          entityId={stageData.id}
          title="Notes"
          emptyLabel="No notes yet."
          disabled={!canWriteNotes || trackStatus === 'cancelled'}
          disabledReason={trackStatus === 'cancelled' ? NOTES_CANCELLED_REASON : ''}
          hideAuthor
          plain
          editableOwn
        />
      </Box>

      {canAct && isRequestReady && (
        <Box sx={{ mt: 2 }}>
          {stageData.status === 'not_started' && isBlockedByPredecessor && (
            <Typography variant="caption" color="text.secondary">
              Starts when {predecessorLabel} is complete.
            </Typography>
          )}
          {stageData.status === 'not_started' && !isBlockedByPredecessor && (
            <Button variant="outlined" disabled={submitting} onClick={onStart}>Start {STAGE_LABELS[stage]}</Button>
          )}
          {isInProgress && (
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined" disabled={submitting || !dirty}
                onClick={() => onSaveDates({ startDate: startDraft || null, endDate: endDraft || null, documentUrl: linkDraft.trim() || null })}
              >
                Save
              </Button>
              <Button variant="contained" disabled={submitting} onClick={onOpenComplete}>Mark {STAGE_LABELS[stage]} complete</Button>
            </Stack>
          )}
        </Box>
      )}
    </Paper>
  );
}

/** Same shape as ChangeRequestDetailPage.jsx's AssignCard — bulk-assign all three stages at once. */
function AssignCard({
  stages, candidates, onSave, submitting,
}) {
  const stageValue = (stage) => stages.find((s) => s.stage === stage)?.assigneeId || '';
  const [draft, setDraft] = useState(() => ({
    development: stageValue('development'), testing: stageValue('testing'), deployment: stageValue('deployment'),
  }));
  useEffect(() => {
    setDraft({ development: stageValue('development'), testing: stageValue('testing'), deployment: stageValue('deployment') });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages]);

  const original = { development: stageValue('development'), testing: stageValue('testing'), deployment: stageValue('deployment') };
  const hasChanges = STAGE_ORDER.some((stage) => draft[stage] !== original[stage]);

  const optionsFor = (stage) => {
    const stageData = stages.find((s) => s.stage === stage);
    const already = candidates.some((c) => c.id === stageData?.assigneeId);
    if (stageData?.assigneeId && !already && stageData.assignee) {
      return [{ id: stageData.assigneeId, name: stageData.assignee.name, roleLabel: null }, ...candidates];
    }
    return candidates;
  };

  const save = () => {
    const payload = {};
    STAGE_ORDER.forEach((stage) => {
      if (draft[stage] !== original[stage]) payload[stage] = draft[stage] || null;
    });
    onSave(payload);
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={700}>Assign the work</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Only you can change these. Each person is notified when it becomes their turn, not when you assign.
      </Typography>
      <Stack spacing={2}>
        {STAGE_ORDER.map((stage) => {
          const stageData = stages.find((s) => s.stage === stage);
          const isComplete = stageData?.status === 'complete';
          return (
            <TextField
              key={stage}
              select fullWidth size="small" label={STAGE_LABELS[stage]}
              disabled={isComplete}
              value={isComplete ? (stageData.assigneeId || '') : draft[stage]}
              onChange={(e) => setDraft((prev) => ({ ...prev, [stage]: e.target.value }))}
            >
              <MenuItem value="">Unassigned</MenuItem>
              {optionsFor(stage).map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name}{c.roleLabel ? ` — ${c.roleLabel}` : ''}</MenuItem>
              ))}
            </TextField>
          );
        })}
        <Button variant="contained" fullWidth disabled={!hasChanges || submitting} onClick={save}>
          Save assignments
        </Button>
      </Stack>
    </Paper>
  );
}

export default function ApplicationTrackingDetailPage() {
  const { id } = useParams();
  const user = useAppSelector((s) => s.auth.user);
  const isSuperAdmin = usePermission('*', 'manage');
  const { showSuccess, showError } = useToast();
  const { data: track, loading, error, reload } = useResource(() => applicationTrackingApi.getById(id), [id]);
  const [submitting, setSubmitting] = useState(false);
  const [completingStage, setCompletingStage] = useState(null);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [candidates, setCandidates] = useState([]);

  useBreadcrumbLabel(track?.name);

  useEffect(() => {
    applicationTrackingApi.assigneeCandidates(id)
      .then((res) => setCandidates(res.data))
      .catch(() => setCandidates([]));
  }, [id]);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!track) return null;

  const isOwner = track.ownerId === user?.id || track.owner?.id === user?.id;
  const isOwnerOrSuper = isOwner || isSuperAdmin;
  const isActive = track.status === 'active';
  const isLiveWithoutApp = track.status === 'live' && !track.application;

  const canActOnStage = (stageData) => isSuperAdmin || isOwner || (!!stageData.assigneeId && stageData.assigneeId === user?.id);
  // Narrower than canActOnStage — notes are the assignee's own work-log, not the owner's to write
  // on their behalf, so the owner doesn't get a pass here the way they do for starting/completing.
  const canWriteNotesOnStage = (stageData) => isSuperAdmin || (!!stageData.assigneeId && stageData.assigneeId === user?.id);
  const canManageAssignments = isOwnerOrSuper && track.status !== 'cancelled' && track.status !== 'live'
    && track.stages.some((s) => s.status !== 'complete');

  const patchStage = async (stage, payload, successMessage) => {
    setSubmitting(true);
    try {
      await applicationTrackingApi.updateStage(id, stage, payload);
      showSuccess(successMessage);
      await reload();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to update stage');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkComplete = async (stage, note) => {
    setSubmitting(true);
    try {
      if (note) {
        const stageData = track.stages.find((s) => s.stage === stage);
        await commentsApi.create({ entityType: 'application_track_stage', entityId: stageData.id, body: note });
      }
      await applicationTrackingApi.updateStage(id, stage, { status: 'complete' });
      showSuccess(`${STAGE_LABELS[stage]} complete`);
      setCompletingStage(null);
      await reload();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to complete the stage');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePriorityChange = async (priority) => {
    await applicationTrackingApi.update(id, { priority });
    showSuccess('Priority updated');
    await reload();
  };

  const handleHold = async (reason) => {
    await applicationTrackingApi.hold(id, { reason });
    showSuccess('Track put on hold');
    await reload();
  };

  const handleResume = async () => {
    setSubmitting(true);
    try {
      await applicationTrackingApi.resume(id);
      showSuccess('Track resumed');
      await reload();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to resume');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (reason) => {
    await applicationTrackingApi.cancel(id, { reason });
    showSuccess('Track cancelled');
    await reload();
  };

  const handleGoLive = async () => {
    setSubmitting(true);
    try {
      await applicationTrackingApi.goLive(id);
      showSuccess('Application registered — this track is now live');
      await reload();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to move this track live');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkAssign = async (payload) => {
    if (Object.keys(payload).length === 0) return;
    setSubmitting(true);
    try {
      await applicationTrackingApi.assignStages(id, payload);
      showSuccess('Assignments updated');
      await reload();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to update assignments');
    } finally {
      setSubmitting(false);
    }
  };

  const chip = deriveStatusChip(track);
  const deploymentStage = track.stages?.find((s) => s.stage === 'deployment');
  // Excludes the stage's own assignee — they get the equivalent "Deployment is yours..." wording
  // from the banner below instead, so the two don't stack on top of each other for the same person.
  const showGoLivePanel = isActive && deploymentStage?.status === 'in_progress' && canActOnStage(deploymentStage)
    && deploymentStage.assigneeId !== user?.id;
  // Completing Deployment no longer registers the Application by itself — this is the deliberate,
  // owner-only step that does, once every stage (including Deployment) is actually complete.
  const allStagesComplete = STAGE_ORDER.every((s) => track.stages?.find((x) => x.stage === s)?.status === 'complete');
  const readyToGoLive = isActive && allStagesComplete && !track.applicationId;

  // Banner — same "your turn" / "waiting on X" messaging ChangeRequestDetailPage.jsx shows its own
  // stage assignees, so someone assigned Testing sees plainly that Development has to finish first
  // and who they're waiting on, not just a generic status chip.
  const viewerStageIndex = STAGE_ORDER.findIndex((stage) => {
    const s = track.stages?.find((x) => x.stage === stage);
    return !!s?.assigneeId && s.assigneeId === user?.id;
  });
  let banner = null;
  if (viewerStageIndex >= 0 && isActive && track.stages[viewerStageIndex].status !== 'complete') {
    const stage = STAGE_ORDER[viewerStageIndex];
    const stageData = track.stages[viewerStageIndex];
    const isBlocked = viewerStageIndex > 0 && track.stages[viewerStageIndex - 1].status !== 'complete';
    if (stageData.status === 'in_progress' || !isBlocked) {
      const isLast = viewerStageIndex === STAGE_ORDER.length - 1;
      const nextName = !isLast ? track.stages[viewerStageIndex + 1]?.assignee?.name : null;
      const ownerName = isOwner ? 'you' : (track.owner?.name || 'the owner');
      banner = {
        severity: 'info',
        text: isLast
          ? `${STAGE_LABELS[stage]} is yours. Mark it complete when you're done — ${ownerName} can then move this track to the Applications catalogue.`
          : `${STAGE_LABELS[stage]} is yours. Mark it complete when you're done and ${nextName || 'the next assignee'} picks up ${STAGE_LABELS[STAGE_ORDER[viewerStageIndex + 1]]}.`,
      };
    } else {
      const predecessor = track.stages[viewerStageIndex - 1];
      banner = {
        severity: 'warning',
        text: `${STAGE_LABELS[stage]} is yours, but not yet. You'll be notified the moment ${predecessor.assignee?.name || 'the assignee'} finishes ${STAGE_LABELS[predecessor.stage]}.`,
      };
    }
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1}>
        <BackButton />
        <Typography variant="body2" color="text.secondary">
          Owner by, <Typography component="span" variant="body2" fontWeight={700} color="text.primary">{track.owner?.name || '—'}</Typography>
        </Typography>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mt: 1, mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap rowGap={1}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h5" fontWeight={700}>{track.name}</Typography>
            <PriorityChip priority={track.priority} />
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1}>
            <StatusBadge color={chip.color} label={chip.label} />
            {isOwnerOrSuper && (
              <Stack direction="row" spacing={1}>
                {isActive && <Button size="small" variant="outlined" onClick={() => setPriorityOpen(true)}>Change priority</Button>}
                {isActive && <Button size="small" variant="outlined" onClick={() => setHoldOpen(true)}>Put on hold</Button>}
                {track.status === 'on_hold' && <Button size="small" variant="outlined" onClick={handleResume} disabled={submitting}>Resume</Button>}
                {(isActive || track.status === 'on_hold') && (
                  <Button size="small" variant="outlined" color="error" onClick={() => setCancelOpen(true)}>Cancel</Button>
                )}
              </Stack>
            )}
          </Stack>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {track.idea && (
            <Link component={RouterLink} to={`/ideas/${track.idea.id}`} color="text.secondary" sx={{ '&:hover': { textDecoration: 'underline' } }}>
              From Idea #{track.idea.ideaNumber}
            </Link>
          )}
          {track.targetGoLive ? `${track.idea ? ' · ' : ''}Target go-live ${formatDate(track.targetGoLive)}` : ''}
        </Typography>
        {track.status === 'on_hold' && track.closureReason && (
          <Alert severity="warning" sx={{ mt: 1.5 }}>On hold: {track.closureReason}</Alert>
        )}
        {track.status === 'cancelled' && track.closureReason && (
          <Alert severity="error" sx={{ mt: 1.5 }}>Cancelled: {track.closureReason}</Alert>
        )}
        {isLiveWithoutApp && (
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}>
            The application it produced has since been removed.
          </Typography>
        )}
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: canManageAssignments ? { xs: '1fr', md: '1fr 296px' } : '1fr', gap: 2, alignItems: 'start' }}>
        <Box sx={{ order: { xs: 2, md: 1 } }}>
          <Stack spacing={1.5}>
            {readyToGoLive && isOwnerOrSuper && (
              <Alert
                severity="success"
                action={(
                  <Button color="inherit" size="small" variant="outlined" disabled={submitting} onClick={handleGoLive}>
                    Move to Application
                  </Button>
                )}
              >
                All stages of <strong>{track.name}</strong> are complete. Move it to the Applications
                catalogue to close this track as Live.
              </Alert>
            )}
            {readyToGoLive && !isOwnerOrSuper && (
              <Alert severity="info">
                All stages of <strong>{track.name}</strong> are complete — waiting on {track.owner?.name || 'the owner'} to
                move it to the Applications catalogue.
              </Alert>
            )}
            {banner && <Alert severity={banner.severity}>{banner.text}</Alert>}
            {track.stages?.map((stageData, index) => {
              const stage = stageData.stage;
              const predecessor = index > 0 ? track.stages[index - 1] : null;
              const isBlockedByPredecessor = index > 0 && predecessor.status !== 'complete';
              const isDeployment = stage === 'deployment';
              return (
                <Box key={stageData.id}>
                  {isDeployment && showGoLivePanel && (
                    <Alert severity="info" sx={{ mb: 1.5 }}>
                      Marking Deployment complete notifies {track.owner?.name || 'the owner'} that
                      <strong> {track.name}</strong> is ready — they'll then move it to the Applications
                      catalogue to close this track as Live.
                    </Alert>
                  )}
                  <StageSection
                    stage={stage}
                    stageData={stageData}
                    canAct={canActOnStage(stageData)}
                    canWriteNotes={canWriteNotesOnStage(stageData)}
                    isViewerStage={index === viewerStageIndex}
                    isRequestReady={isActive}
                    trackStatus={track.status}
                    isBlockedByPredecessor={isBlockedByPredecessor}
                    predecessorLabel={predecessor ? STAGE_LABELS[predecessor.stage] : null}
                    predecessorAssigneeName={predecessor?.assignee?.name}
                    submitting={submitting}
                    onStart={() => patchStage(stage, { status: 'in_progress' }, `${STAGE_LABELS[stage]} started`)}
                    onSaveDates={(payload) => patchStage(stage, payload, 'Dates saved')}
                    onOpenComplete={() => setCompletingStage(stage)}
                  />
                </Box>
              );
            })}
          </Stack>
        </Box>
        {canManageAssignments && (
          <Box sx={{ order: { xs: 1, md: 2 }, position: 'sticky', top: 16 }}>
            <AssignCard stages={track.stages} candidates={candidates} onSave={handleBulkAssign} submitting={submitting} />
          </Box>
        )}
      </Box>

      <PriorityDialog
        open={priorityOpen} currentPriority={track.priority}
        onClose={() => setPriorityOpen(false)} onSubmit={handlePriorityChange}
      />
      <ReasonDialog
        open={holdOpen} title="Put this track on hold" submitLabel="Put on hold"
        copy="Stages can't be progressed while a track is on hold — anyone assigned to it will be notified."
        onClose={() => setHoldOpen(false)} onSubmit={handleHold}
      />
      <ReasonDialog
        open={cancelOpen} title="Cancel this track" submitLabel="Cancel track" danger
        copy="This closes the track permanently — it stays as a record, but can never be resumed."
        onClose={() => setCancelOpen(false)} onSubmit={handleCancel}
      />
      <MarkCompleteDialog
        open={!!completingStage}
        stage={completingStage}
        isLastStage={completingStage === STAGE_ORDER[STAGE_ORDER.length - 1]}
        submitting={submitting}
        onClose={() => setCompletingStage(null)}
        onConfirm={(note) => handleMarkComplete(completingStage, note)}
      />
    </Box>
  );
}

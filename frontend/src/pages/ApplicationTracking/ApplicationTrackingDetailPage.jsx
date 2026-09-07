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
import {
  STAGE_ORDER, STAGE_LABELS, STAGE_STATUS_LABELS, deriveStatusChip,
} from '../../utils/applicationTrackStatus';

const formatDate = (value) => (value ? dayjs(value).format('MMM D, YYYY') : '—');

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
            ? 'This registers the Application and closes the track as Live.'
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

/** The rail — four compact, read-only summary cards. Not a control. */
function RailStageCard({ stage, stageData }) {
  const chip = {
    color: stageData.status === 'complete' ? 'success' : stageData.status === 'in_progress' ? 'info' : 'default',
    label: STAGE_STATUS_LABELS[stageData.status],
  };
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Typography variant="caption" sx={CAPTION_SX}>{STAGE_LABELS[stage]}</Typography>
      <Box sx={{ mt: 0.5 }}><StatusBadge color={chip.color} label={chip.label} /></Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
        {stageData.assignee?.name || 'Unassigned'}
      </Typography>
      {stageData.startDate && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {formatDate(stageData.startDate)}{stageData.endDate ? ` – ${formatDate(stageData.endDate)}` : ''}
        </Typography>
      )}
    </Paper>
  );
}

/**
 * One of the four stacked sections — the three modes are the whole point of this component:
 *   complete    -> plain text, no inputs
 *   in_progress -> editable date inputs + Save/Mark complete (only if canAct)
 *   not_started -> inputs rendered but disabled, plus one line saying what's waited on
 * Never a disabled action BUTTON (1c/Stage 4 style rule) — canAct=false renders zero buttons, in
 * any mode, rather than greying them out. Assignee is display-only here — reassignment is a
 * distinct owner/super-admin action (1d) this page doesn't expose inline; see the report.
 */
function StageSection({
  stage, stageData, canAct, isBlockedByPredecessor, predecessorLabel, isRequestReady, trackStatus,
  onStart, onSaveDates, onOpenComplete, submitting,
}) {
  const isComplete = stageData.status === 'complete';
  const isInProgress = stageData.status === 'in_progress';
  const editable = isInProgress && canAct;

  const [startDraft, setStartDraft] = useState(stageData.startDate || '');
  const [endDraft, setEndDraft] = useState(stageData.endDate || '');
  useEffect(() => {
    setStartDraft(stageData.startDate || '');
    setEndDraft(stageData.endDate || '');
  }, [stageData.startDate, stageData.endDate]);

  const dirty = editable && (startDraft !== (stageData.startDate || '') || endDraft !== (stageData.endDate || ''));

  const chip = {
    color: isComplete ? 'success' : isInProgress ? 'info' : 'default',
    label: STAGE_STATUS_LABELS[stageData.status],
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1" fontWeight={700}>{STAGE_LABELS[stage]}</Typography>
        <StatusBadge color={chip.color} label={chip.label} />
      </Stack>

      <Grid container spacing={2} sx={{ mt: 0.5, mb: 2 }}>
        <Grid item xs={12} sm={4}>
          <ReadField label="Assignee" value={stageData.assignee?.name} />
        </Grid>
        <Grid item xs={12} sm={4}>
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
        <Grid item xs={12} sm={4}>
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
      </Grid>

      <NotesThread
        entityType="application_track_stage"
        entityId={stageData.id}
        title="Notes"
        emptyLabel="No notes yet."
        disabled={trackStatus === 'cancelled'}
        disabledReason="This track was cancelled — its stages are no longer open for notes."
      />

      {canAct && isRequestReady && (
        <Box sx={{ mt: 2 }}>
          {stageData.status === 'not_started' && isBlockedByPredecessor && (
            <Typography variant="caption" color="text.secondary">
              {STAGE_LABELS[stage]} begins when {predecessorLabel} is marked complete.
            </Typography>
          )}
          {stageData.status === 'not_started' && !isBlockedByPredecessor && (
            <Button variant="outlined" disabled={submitting} onClick={onStart}>Start {STAGE_LABELS[stage]}</Button>
          )}
          {isInProgress && (
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined" disabled={submitting || !dirty}
                onClick={() => onSaveDates({ startDate: startDraft || null, endDate: endDraft || null })}
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

  useBreadcrumbLabel(track?.name);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!track) return null;

  const isOwner = track.ownerId === user?.id || track.owner?.id === user?.id;
  const isOwnerOrSuper = isOwner || isSuperAdmin;
  const isActive = track.status === 'active';
  const isLiveWithoutApp = track.status === 'live' && !track.application;

  const canActOnStage = (stageData) => isSuperAdmin || isOwner || (!!stageData.assigneeId && stageData.assigneeId === user?.id);

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

  const chip = deriveStatusChip(track);
  const deploymentStage = track.stages?.find((s) => s.stage === 'deployment');
  const showGoLivePanel = isActive && deploymentStage?.status === 'in_progress' && canActOnStage(deploymentStage);

  return (
    <Box>
      <BackButton />

      <Paper variant="outlined" sx={{ p: 2, mt: 1, mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap rowGap={1}>
          <Stack direction="row" alignItems="center" spacing={1}>
            {track.status === 'live' && track.application ? (
              <Link
                component={RouterLink} to={`/applications/${track.application.id}`}
                variant="h5" fontWeight={700} color="text.primary"
                sx={{ '&:hover': { textDecoration: 'underline' } }}
              >
                {track.name}
              </Link>
            ) : (
              <Typography variant="h5" fontWeight={700}>{track.name}</Typography>
            )}
            <PriorityChip priority={track.priority} />
            <StatusBadge color={chip.color} label={chip.label} />
          </Stack>
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
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {track.idea && (
            <Link component={RouterLink} to={`/ideas/${track.idea.id}`} color="text.secondary" sx={{ '&:hover': { textDecoration: 'underline' } }}>
              From Idea #{track.idea.ideaNumber}
            </Link>
          )}
          {' · '}Owner-to-be {track.owner?.name || '—'}
          {track.targetGoLive ? ` · Target go-live ${formatDate(track.targetGoLive)}` : ''}
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

      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        {track.stages?.map((s) => (
          <Grid item xs={6} sm={3} key={s.id}>
            <RailStageCard stage={s.stage} stageData={s} />
          </Grid>
        ))}
      </Grid>

      <Stack spacing={1.5}>
        {track.stages?.map((stageData, index) => {
          const stage = stageData.stage;
          const predecessor = index > 0 ? track.stages[index - 1] : null;
          const isBlockedByPredecessor = index > 0 && predecessor.status !== 'complete';
          const isDeployment = stage === 'deployment';
          return (
            <Box key={stageData.id}>
              {isDeployment && showGoLivePanel && (
                <Alert severity="info" sx={{ mb: 1.5 }}>
                  Marking Deployment complete registers <strong>{track.name}</strong> in the Applications
                  catalogue under {track.owner?.name || 'its owner'} — from that point people can raise
                  issues and feature requests against it, and this track closes as Live.
                </Alert>
              )}
              <StageSection
                stage={stage}
                stageData={stageData}
                canAct={canActOnStage(stageData)}
                isRequestReady={isActive}
                trackStatus={track.status}
                isBlockedByPredecessor={isBlockedByPredecessor}
                predecessorLabel={predecessor ? STAGE_LABELS[predecessor.stage] : null}
                submitting={submitting}
                onStart={() => patchStage(stage, { status: 'in_progress' }, `${STAGE_LABELS[stage]} started`)}
                onSaveDates={(payload) => patchStage(stage, payload, 'Dates saved')}
                onOpenComplete={() => setCompletingStage(stage)}
              />
            </Box>
          );
        })}
      </Stack>

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

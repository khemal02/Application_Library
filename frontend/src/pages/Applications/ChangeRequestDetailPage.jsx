import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import dayjs from 'dayjs';
import { changeRequestsApi, commentsApi } from '../../services/domains';
import { useAppSelector } from '../../app/hooks';
import useResource from '../../hooks/useResource';
import useBreadcrumbLabel from '../../hooks/useBreadcrumbLabel';
import useToast from '../../hooks/useToast';
import usePermission from '../../routes/usePermission';
import { LoadingBlock, ErrorBlock } from '../../components/common/AsyncState';
import StatusBadge from '../../components/common/StatusBadge';
import BackButton from '../../components/common/BackButton';
import NotesThread from '../../components/common/NotesThread';
import { STAGE_ORDER, STAGE_LABELS, STAGE_STATUS_LABELS, deriveStatusChip } from '../../utils/changeRequestStatus';

const formatDate = (value) => (value ? dayjs(value).format('MMM D, YYYY') : '—');

// Backend's own wording, reused verbatim (comments.service.js's 'change_request_stage' branch) —
// what the UI pre-emptively disables should say exactly what the server would say if bypassed.
const NOTES_NOT_STARTED_REASON = 'This stage has not started yet — there is nothing to add a note about.';
const NOTES_NOT_PERMITTED_REASON = "Only the application's owner, this stage's assignee, or a super-admin may add notes here.";

const CAPTION_SX = {
  display: 'block', textTransform: 'uppercase', letterSpacing: '.07em', color: 'text.disabled',
};

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
 * Mark-complete confirmation — the one dialog in this screen (Start has none, it just starts). If
 * the note is filled, it posts through the comments API BEFORE the status PATCH: a note is evidence
 * of what happened during the stage, so if it can't be recorded, the stage shouldn't silently
 * complete without it — better to stop and let the user retry than advance history it couldn't
 * actually write down.
 */
function MarkCompleteDialog({
  open, onClose, stage, nextAssigneeName, isLastStage, onConfirm, submitting,
}) {
  const [note, setNote] = useState('');
  useEffect(() => { if (open) setNote(''); }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Mark {STAGE_LABELS[stage]} complete?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {isLastStage
            ? 'This completes the change request.'
            : nextAssigneeName
              ? `${STAGE_LABELS[STAGE_ORDER[STAGE_ORDER.indexOf(stage) + 1]]} becomes ${nextAssigneeName}'s next, and they'll be notified.`
              : `${STAGE_LABELS[STAGE_ORDER[STAGE_ORDER.indexOf(stage) + 1]]} is next, once someone is assigned to it.`}
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
 * One stage — read-only fields, its own NotesThread, and (only for a viewer who may act here) an
 * actions row. Collapsed, it's just the clickable header line; per-viewer expansion rules live in
 * the parent, which passes the resolved `expanded` boolean down.
 */
function StageCard({
  stage, stageData, expanded, onToggleExpand,
  isViewerStage, canAct, isRequestReady, isBlockedByPredecessor, predecessorLabel, predecessorAssigneeName,
  onStart, onOpenComplete, submitting,
}) {
  const isComplete = stageData.status === 'complete';

  let chip;
  if (isViewerStage && !isComplete) {
    const actionableNow = stageData.status === 'in_progress' || !isBlockedByPredecessor;
    chip = actionableNow
      ? { color: 'info', label: 'Your turn' }
      : { color: 'warning', label: `Waiting on ${predecessorAssigneeName || 'someone'}` };
  } else {
    chip = {
      color: isComplete ? 'success' : stageData.status === 'in_progress' ? 'info' : 'default',
      label: STAGE_STATUS_LABELS[stageData.status],
    };
  }

  const notesDisabled = !canAct ? NOTES_NOT_PERMITTED_REASON : stageData.status === 'not_started' ? NOTES_NOT_STARTED_REASON : null;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack
        direction="row" justifyContent="space-between" alignItems="center"
        role="button" tabIndex={0} onClick={onToggleExpand}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleExpand(); } }}
        sx={{ cursor: 'pointer', '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '2px' } }}
      >
        <Typography variant="subtitle1" fontWeight={700}>
          {STAGE_LABELS[stage]}{isViewerStage ? ' — you' : ''}
        </Typography>
        <StatusBadge color={chip.color} label={chip.label} />
      </Stack>

      {expanded && (
        <>
          <Stack direction="row" spacing={2} sx={{ mt: 2, mb: 2 }}>
            <Box sx={{ flex: 1 }}><ReadField label="Assigned to" value={stageData.assignee?.name} /></Box>
            <Box sx={{ flex: 1 }}><ReadField label="Started" value={formatDate(stageData.startDate)} /></Box>
            <Box sx={{ flex: 1 }}><ReadField label="Finished" value={formatDate(stageData.endDate)} /></Box>
          </Stack>

          <NotesThread
            entityType="change_request_stage"
            entityId={stageData.id}
            title="Notes"
            emptyLabel="No notes yet."
            disabled={!!notesDisabled}
            disabledReason={notesDisabled || undefined}
          />

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
              {stageData.status === 'in_progress' && (
                <Button variant="contained" disabled={submitting} onClick={onOpenComplete}>Mark {STAGE_LABELS[stage]} complete</Button>
              )}
            </Box>
          )}
        </>
      )}
    </Paper>
  );
}

/**
 * The rail's top card — owner/super-admin only, and only while at least one stage can still be
 * reassigned. One bulk PATCH on Save, carrying only the stages whose value actually changed
 * (Stage 1b's contract) — never one call per select.
 */
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

/**
 * Hand-rolled, not MUI's Stepper — StepContent only ever renders its extra content for the single
 * ACTIVE step, and this needs four independent visual states on every dot at once (done, current,
 * "yours and waiting", everything else), which Stepper's own active/completed model can't express.
 */
function ProgressCard({ stages, user }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Progress</Typography>
      <Box sx={{ position: 'relative', pl: 3 }}>
        {STAGE_ORDER.map((stage, i) => {
          const stageData = stages.find((s) => s.stage === stage);
          const isLast = i === STAGE_ORDER.length - 1;
          const isViewerStage = !!stageData.assigneeId && stageData.assigneeId === user?.id;
          const isBlocked = i > 0 && stages.find((s) => s.stage === STAGE_ORDER[i - 1])?.status !== 'complete';

          let dotColor = 'grey.400';
          if (stageData.status === 'complete') dotColor = 'success.main';
          else if (stageData.status === 'in_progress') dotColor = 'primary.main';
          else if (isViewerStage && isBlocked) dotColor = 'warning.main';

          return (
            <Box key={stage} sx={{ position: 'relative', pb: isLast ? 0 : 3 }}>
              {!isLast && (
                <Box sx={{
                  position: 'absolute', left: -19, top: 20, bottom: 0, width: '2px', bgcolor: 'divider',
                }}
                />
              )}
              <Box sx={{
                position: 'absolute', left: -24, top: 2, width: 20, height: 20, borderRadius: '50%', bgcolor: dotColor,
              }}
              />
              <Typography variant="body2" fontWeight={700}>{STAGE_LABELS[stage]}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {stageData.assignee?.name || 'Unassigned'}
              </Typography>
              {stageData.status === 'not_started' ? (
                <StatusBadge
                  size="small"
                  color={isViewerStage ? (isBlocked ? 'warning' : 'info') : 'default'}
                  label={isViewerStage ? (isBlocked ? 'Waiting' : 'Your turn') : 'Not started'}
                />
              ) : (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {stageData.status === 'complete'
                    ? `Started ${formatDate(stageData.startDate)} · Finished ${formatDate(stageData.endDate)}`
                    : `Started ${formatDate(stageData.startDate)}`}
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

export default function ChangeRequestDetailPage() {
  const { applicationId, changeRequestId } = useParams();
  const user = useAppSelector((s) => s.auth.user);
  const isSuperAdmin = usePermission('*', 'manage');
  const { showSuccess, showError } = useToast();
  const { data, loading, error, reload } = useResource(
    () => changeRequestsApi.getById(applicationId, changeRequestId),
    [applicationId, changeRequestId],
  );
  const [candidates, setCandidates] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [completingStage, setCompletingStage] = useState(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [forcedExpand, setForcedExpand] = useState({});

  useBreadcrumbLabel(data?.application?.name, `/applications/${applicationId}`);
  useBreadcrumbLabel(data?.title);

  useEffect(() => {
    changeRequestsApi.assigneeCandidates(applicationId, changeRequestId)
      .then((res) => setCandidates(res.data))
      .catch(() => setCandidates([]));
  }, [applicationId, changeRequestId]);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!data) return null;

  const isOwner = data.application?.ownerId === user?.id;
  const isRequestReady = data.status === 'approved' || data.status === 'implemented';
  const canActOnStage = (stageData) => isSuperAdmin || isOwner || (!!stageData.assigneeId && stageData.assigneeId === user?.id);
  const canManageAssignments = (isOwner || isSuperAdmin) && data.stages.some((s) => s.status !== 'complete');

  const patchStage = async (stage, payload, successMessage) => {
    setSubmitting(true);
    try {
      await changeRequestsApi.updateStage(applicationId, changeRequestId, stage, payload);
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
        // Posted BEFORE the status PATCH — a note is evidence of what happened during the stage;
        // if it can't be recorded, the stage shouldn't advance without it. If this throws, the
        // catch below stops here and the stage stays exactly as it was.
        const stageData = data.stages.find((s) => s.stage === stage);
        await commentsApi.create({ entityType: 'change_request_stage', entityId: stageData.id, body: note });
      }
      await changeRequestsApi.updateStage(applicationId, changeRequestId, stage, { status: 'complete' });
      showSuccess(`${STAGE_LABELS[stage]} complete`);
      setCompletingStage(null);
      await reload();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to complete the stage');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkAssign = async (payload) => {
    if (Object.keys(payload).length === 0) return;
    setSubmitting(true);
    try {
      await changeRequestsApi.bulkAssignStages(applicationId, changeRequestId, payload);
      showSuccess('Assignments updated');
      await reload();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to update assignments');
    } finally {
      setSubmitting(false);
    }
  };

  const chip = deriveStatusChip(data);
  const viewerStageIndex = STAGE_ORDER.findIndex((stage) => {
    const s = data.stages.find((x) => x.stage === stage);
    return !!s?.assigneeId && s.assigneeId === user?.id;
  });

  // Banner — at most one, priority: viewer's own stage (actionable, then waiting), else requester.
  // A COMPLETE stage is neither "actionable" nor "waiting" — there's nothing left to say about it,
  // so it falls through to no banner at all (or the requester banner, if that also applies).
  let banner = null;
  if (viewerStageIndex >= 0 && isRequestReady && data.stages[viewerStageIndex].status !== 'complete') {
    const stage = STAGE_ORDER[viewerStageIndex];
    const stageData = data.stages[viewerStageIndex];
    const isBlocked = viewerStageIndex > 0 && data.stages[viewerStageIndex - 1].status !== 'complete';
    if (stageData.status === 'in_progress' || !isBlocked) {
      const isLast = viewerStageIndex === STAGE_ORDER.length - 1;
      const nextName = !isLast ? data.stages[viewerStageIndex + 1]?.assignee?.name : null;
      banner = {
        severity: 'info',
        text: isLast
          ? `${STAGE_LABELS[stage]} is yours. Mark it complete when you're done — that finishes this change request.`
          : `${STAGE_LABELS[stage]} is yours. Mark it complete when you're done and ${nextName || 'the next assignee'} picks up ${STAGE_LABELS[STAGE_ORDER[viewerStageIndex + 1]]}.`,
      };
    } else {
      const predecessor = data.stages[viewerStageIndex - 1];
      banner = {
        severity: 'warning',
        text: `${STAGE_LABELS[stage]} is yours, but not yet. You'll be notified the moment ${predecessor.assignee?.name || 'the assignee'} finishes ${STAGE_LABELS[predecessor.stage]}.`,
      };
    }
  } else if (data.requestedBy === user?.id && data.status === 'approved') {
    banner = {
      severity: 'info',
      // `updatedAt` doubles as the approval timestamp here: nothing else touches the change
      // request's own row between approval and implementation (stage edits update the STAGE row,
      // not this one), and this banner only ever shows in that exact window.
      text: `This is your request. It was approved on ${formatDate(data.updatedAt)} and is now being built. You'll be notified when it's deployed.`,
    };
  }

  const isExpanded = (index) => {
    if (forcedExpand[index] !== undefined) return forcedExpand[index];
    // A finished stage is a historical fact (who did it, when) — visible to everyone, not just
    // whoever happens to be involved. The viewer-relative rules below only matter for a stage
    // that's still open.
    if (data.stages[index].status === 'complete') return true;
    if (data.stages[index].status === 'in_progress') return true;
    if (index === viewerStageIndex) return true;
    if (index === viewerStageIndex - 1) return true;
    return false;
  };
  const toggleExpand = (index) => setForcedExpand((prev) => ({ ...prev, [index]: !isExpanded(index) }));

  const description = data.description || '';
  const showDescToggle = description.length > 220;

  return (
    <Box>
      <BackButton>Back to {data.application?.name || 'application'}</BackButton>

      <Paper variant="outlined" sx={{ p: 2, mt: 1, mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap rowGap={1}>
          <Typography variant="h5" fontWeight={700}>{data.title}</Typography>
          <StatusBadge color={chip.color} label={chip.label} />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {data.requester?.name || 'Unknown user'} · requested {formatDate(data.createdAt)}
        </Typography>
        {description && (
          <Box sx={{ mt: 1.5 }}>
            <Typography
              variant="body2" color="text.secondary"
              sx={descExpanded ? { whiteSpace: 'pre-wrap' } : {
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}
            >
              {description}
            </Typography>
            {showDescToggle && (
              <Typography
                variant="caption" color="primary" role="button" tabIndex={0}
                onClick={() => setDescExpanded((v) => !v)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDescExpanded((v) => !v); } }}
                sx={{ display: 'inline-block', mt: 0.5, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
              >
                {descExpanded ? 'Show less' : 'Show more'}
              </Typography>
            )}
          </Box>
        )}
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 296px' }, gap: 2, alignItems: 'start' }}>
        <Box sx={{ order: { xs: 2, md: 1 } }}>
          <Stack spacing={1.5}>
            {banner && <Alert severity={banner.severity}>{banner.text}</Alert>}
            {data.stages.map((stageData, index) => {
              const stage = stageData.stage;
              const predecessor = index > 0 ? data.stages[index - 1] : null;
              const isBlockedByPredecessor = index > 0 && predecessor.status !== 'complete';
              return (
                <StageCard
                  key={stageData.id}
                  stage={stage}
                  stageData={stageData}
                  expanded={isExpanded(index)}
                  onToggleExpand={() => toggleExpand(index)}
                  isViewerStage={index === viewerStageIndex}
                  isOwnerOrSuper={isOwner || isSuperAdmin}
                  canAct={canActOnStage(stageData)}
                  isRequestReady={isRequestReady}
                  isBlockedByPredecessor={isBlockedByPredecessor}
                  predecessorLabel={predecessor ? STAGE_LABELS[predecessor.stage] : null}
                  predecessorAssigneeName={predecessor?.assignee?.name}
                  submitting={submitting}
                  onStart={() => patchStage(stage, { status: 'in_progress' }, `${STAGE_LABELS[stage]} started`)}
                  onOpenComplete={() => setCompletingStage(stage)}
                />
              );
            })}
          </Stack>
        </Box>

        <Box sx={{ order: { xs: 1, md: 2 }, position: 'sticky', top: 16 }}>
          <Stack spacing={1.5}>
            {canManageAssignments && (
              <AssignCard stages={data.stages} candidates={candidates} onSave={handleBulkAssign} submitting={submitting} />
            )}
            <ProgressCard stages={data.stages} user={user} />
          </Stack>
        </Box>
      </Box>

      <MarkCompleteDialog
        open={!!completingStage}
        stage={completingStage}
        isLastStage={completingStage === STAGE_ORDER[STAGE_ORDER.length - 1]}
        nextAssigneeName={completingStage ? data.stages[STAGE_ORDER.indexOf(completingStage) + 1]?.assignee?.name : null}
        submitting={submitting}
        onClose={() => setCompletingStage(null)}
        onConfirm={(note) => handleMarkComplete(completingStage, note)}
      />
    </Box>
  );
}

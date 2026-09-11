import { useEffect, useRef, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import dayjs from 'dayjs';
import { changeRequestsApi, attachmentsApi } from '../../services/domains';
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
      <Typography variant="body2" component="div" color={value ? 'text.primary' : 'text.disabled'} sx={{ mt: 0.25 }}>
        {value || '—'}
      </Typography>
    </Box>
  );
}

/** A stage's document, opened two ways: "View" renders it inline (the backend only does that for
 * PDF/JPG — see app.js's `/uploads` middleware; other types just download either way, since
 * browsers have no built-in viewer for them) and "Download" always forces a save-to-disk via the
 * same route's `?download` override, regardless of type. */
function DocumentLinks({ url }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Link href={url} target="_blank" rel="noopener noreferrer" variant="body2">View</Link>
      <Link href={`${url}?download`} variant="body2">Download</Link>
    </Stack>
  );
}

/** A plain Yes/No confirmation prompt — reused for both "Mark {Stage} complete" and
 * "Implemented", the only difference being the question asked. */
function ConfirmYesNoDialog({
  open, title, onClose, onConfirm, submitting,
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>No</Button>
        <Button variant="contained" disabled={submitting} onClick={onConfirm}>Yes</Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * One of the three stacked stage cards — same shape as Idea Prioritization's own StageSection
 * (ApplicationTrackingDetailPage.jsx), minus a separate "Expected finish" field: this module only
 * ever tracked Started (planned/actual start) and Finished (the real completion date, set only by
 * the server on complete) — there's no distinct target date to plan against.
 */
function StageCard({
  stage, stageData, canAssign, canAct, canWriteNotes, isBlockedByPredecessor, predecessorLabel, predecessorAssigneeName,
  isViewerStage, isRequestReady, candidates, onStart, onAssign, onOpenComplete, submitting,
}) {
  const isComplete = stageData.status === 'complete';
  const isInProgress = stageData.status === 'in_progress';
  // Owner/super-admin only — planning Started is the owner's job (the same person who names the
  // assignee), not the assignee's own to edit. A completed stage locks it back down to a
  // historical record (canAssign already excludes complete stages).
  const datesEditable = canAssign;
  // `canAct` (assignee-or-super, NO owner) — narrower than `canWriteNotes` (owner/assignee/super,
  // Notes' own deliberately broader rule). The document is the assignee's own deliverable to
  // attach, only meaningful once work is actually under way — the owner doesn't get a pass here
  // just for being able to name the assignee.
  const linkEditable = isInProgress && canAct;
  const [assigning, setAssigning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  const [startDraft, setStartDraft] = useState(stageData.startDate || '');
  const [assigneeDraft, setAssigneeDraft] = useState(stageData.assigneeId || '');
  useEffect(() => {
    setStartDraft(stageData.startDate || '');
  }, [stageData.startDate]);
  // Deliberately its own effect, not folded into the one above — an unconfirmed assignee pick
  // must never get wiped out by an unrelated reload. This one only resyncs when the stage's
  // STORED assigneeId itself changes (i.e. after a real commit, or someone else's edit).
  useEffect(() => {
    setAssigneeDraft(stageData.assigneeId || '');
  }, [stageData.assigneeId]);

  // The current assignee might not be in the active-candidates list any more (e.g. deactivated) —
  // the select still shows who's actually assigned instead of rendering blank.
  const assigneeOptions = (!stageData.assigneeId || candidates.some((c) => c.id === stageData.assigneeId))
    ? candidates
    : [{ id: stageData.assigneeId, name: stageData.assignee?.name, roleLabel: null }, ...candidates];

  // "Assignee" only enables once both fields it commits are filled in — name AND Started.
  // Picking "Unassigned" keeps it disabled too, same as leaving the name blank — no exception for
  // clearing an existing assignment through this button.
  const needsDateFirst = !!assigneeDraft && !startDraft;
  const assigneeDirty = canAssign && !!assigneeDraft && !!startDraft;
  const confirmAssign = async () => {
    setAssigning(true);
    try {
      // Carries the draft date along with the assignment — this is the only way the owner's
      // Started date ever gets persisted, there's no separate Save for it.
      await onAssign({
        assigneeId: assigneeDraft || null,
        ...(assigneeDraft && datesEditable ? { startDate: startDraft || null } : {}),
      });
    } finally {
      setAssigning(false);
    }
  };

  // A planned date is the owner's own draft of a stage nobody's picked up yet — showing it to
  // every viewer before anyone's actually assigned made an unassigned stage look like it already
  // had a start in motion. The owner still sees their own plan; everyone else sees "—" for these
  // fields until the stage genuinely has an assignee.
  const datesVisible = !!stageData.assigneeId || canAssign;

  const handleDocumentUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError('');
    setUploading(true);
    try {
      const uploaded = await attachmentsApi.upload('change_request_stage', stageData.id, file);
      await onAssign({ documentUrl: uploaded.data.url });
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Failed to upload the document');
    } finally {
      setUploading(false);
    }
  };

  // "Your turn"/"Waiting on X" only apply BEFORE the assignee has actually started — once they
  // click Start, their own view should read the same real status ("In progress") everyone else
  // already sees, not stay stuck on the pre-start "Your turn" label forever.
  let chip;
  if (isViewerStage && !isComplete && !isInProgress) {
    chip = !isBlockedByPredecessor
      ? { color: 'info', label: 'Your turn' }
      : { color: 'warning', label: `Waiting on ${predecessorAssigneeName || 'someone'}` };
  } else {
    chip = {
      color: isComplete ? 'success' : isInProgress ? 'info' : 'default',
      label: STAGE_STATUS_LABELS[stageData.status],
    };
  }

  const notesDisabled = !canWriteNotes ? NOTES_NOT_PERMITTED_REASON : stageData.status === 'not_started' ? NOTES_NOT_STARTED_REASON : null;

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
          {canAssign ? (
            <TextField
              select fullWidth size="small" label="Assignee"
              value={assigneeDraft} disabled={assigning}
              onChange={(e) => setAssigneeDraft(e.target.value)}
              InputLabelProps={{ shrink: true }}
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="">Unassigned</MenuItem>
              {assigneeOptions.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name}{c.roleLabel ? ` — ${c.roleLabel}` : ''}</MenuItem>
              ))}
            </TextField>
          ) : (
            <ReadField label="Assigned to" value={stageData.assignee?.name} />
          )}
        </Grid>
        <Grid item xs={6} sm={3}>
          {datesEditable ? (
            <TextField
              fullWidth size="small" label="Started" type="date" InputLabelProps={{ shrink: true }}
              value={startDraft} disabled={submitting || assigning}
              onChange={(e) => setStartDraft(e.target.value)}
            />
          ) : (
            <ReadField label="Started" value={datesVisible ? formatDate(stageData.startDate) : null} />
          )}
        </Grid>
        <Grid item xs={6} sm={3}>
          <ReadField label="Finished" value={datesVisible ? formatDate(stageData.endDate) : null} />
        </Grid>
        <Grid item xs={6} sm={3}>
          {linkEditable ? (
            <Box>
              <Typography variant="caption" sx={CAPTION_SX}>Document link</Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
                {stageData.documentUrl && <DocumentLinks url={stageData.documentUrl} />}
                <Button
                  size="small" variant="text"
                  startIcon={uploading ? <CircularProgress size={14} /> : <UploadFileOutlinedIcon fontSize="small" />}
                  disabled={uploading || submitting}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? 'Uploading…' : stageData.documentUrl ? 'Replace' : 'Upload'}
                </Button>
                <input
                  ref={fileInputRef} type="file" hidden onChange={handleDocumentUpload}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg"
                  aria-label="Upload document"
                />
              </Stack>
              {uploadError && <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.25 }}>{uploadError}</Typography>}
            </Box>
          ) : (
            <ReadField
              label="Document link"
              value={datesVisible && stageData.documentUrl ? <DocumentLinks url={stageData.documentUrl} /> : null}
            />
          )}
        </Grid>
      </Grid>

      <Box sx={{ mt: 2 }}>
        <NotesThread
          entityType="change_request_stage"
          entityId={stageData.id}
          title="Notes"
          emptyLabel="No notes yet."
          disabled={!!notesDisabled}
          disabledReason={notesDisabled || undefined}
          plain
          editableOwn
        />
      </Box>

      {isRequestReady && (
        <Box sx={{ mt: 2 }}>
          {stageData.status === 'not_started' && isBlockedByPredecessor && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Starts when {predecessorLabel} is complete.
            </Typography>
          )}
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap rowGap={1}>
            <Stack direction="row" spacing={1}>
              {/* Starting/completing the stage is the assignee's own call (or a super-admin's), not
                  the owner's, unless the owner is themselves the assignee — `canAct`, not the
                  broader `canWriteNotes` Notes uses. */}
              {canAct && !isComplete && (
                <Button
                  variant="contained"
                  disabled={submitting || stageData.status !== 'not_started' || isBlockedByPredecessor}
                  onClick={onStart}
                >
                  Start {STAGE_LABELS[stage]}
                </Button>
              )}
              {canAssign && (
                <Tooltip title={needsDateFirst ? 'Set Started before assigning someone.' : ''}>
                  <span>
                    <Button variant="contained" disabled={assigning || !assigneeDirty || needsDateFirst} onClick={confirmAssign}>
                      Assignee
                    </Button>
                  </span>
                </Tooltip>
              )}
            </Stack>
            {canAct && !isComplete && (
              <Button variant="contained" disabled={submitting || !isInProgress} onClick={onOpenComplete}>
                Mark {STAGE_LABELS[stage]} complete
              </Button>
            )}
          </Stack>
        </Box>
      )}
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
  const [confirmingImplement, setConfirmingImplement] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

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
  const isOwnerOrSuper = isOwner || isSuperAdmin;
  const isRequestReady = data.status === 'approved' || data.status === 'implemented';
  // Notes keep their own, intentionally broader rule (owner/assignee/super — see
  // comments.service.js's 'change_request_stage' branch).
  const canWriteNotesOnStage = (stageData) => isOwnerOrSuper || (!!stageData.assigneeId && stageData.assigneeId === user?.id);
  // Narrower than the above — Start/Document-link/Mark-complete are the assignee's own call (or a
  // super-admin's), not the owner's, unless the owner is themselves the assignee. Matches Idea
  // Prioritization's own stages exactly (ApplicationTrackingDetailPage.jsx's canWriteNotesOnStage,
  // confusingly the SAME name there only because that module's Notes rule happens to be this
  // narrow already — here the two rules genuinely differ, hence two separate functions).
  const canActOnStage = (stageData) => isSuperAdmin || (!!stageData.assigneeId && stageData.assigneeId === user?.id);
  const canAssignStage = (stageData) => isOwnerOrSuper && data.status !== 'rejected' && stageData.status !== 'complete';

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

  const handleMarkComplete = async (stage) => {
    setSubmitting(true);
    try {
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

  const handleImplement = async () => {
    setSubmitting(true);
    try {
      await changeRequestsApi.implement(applicationId, changeRequestId);
      showSuccess('Change request marked implemented');
      setConfirmingImplement(false);
      await reload();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to mark this implemented');
    } finally {
      setSubmitting(false);
    }
  };

  // `payload` carries assigneeId and, when the owner is naming someone rather than clearing the
  // assignment, whatever date was in the draft — or just documentUrl, from the assignee's upload.
  const handleAssignStage = async (stage, payload) => {
    try {
      await changeRequestsApi.updateStage(applicationId, changeRequestId, stage, payload);
      showSuccess(payload.documentUrl !== undefined ? 'Document saved' : 'Assignee updated');
      await reload();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to update stage');
    }
  };

  const chip = deriveStatusChip(data);
  // Completing Deployment no longer marks this implemented by itself — this is the deliberate,
  // owner-only step that does, once every stage (including Deployment) is actually complete.
  const readyToImplement = data.status === 'approved' && data.stages.every((s) => s.status === 'complete');
  const viewerStageIndex = STAGE_ORDER.findIndex((stage) => {
    const s = data.stages.find((x) => x.stage === stage);
    return !!s?.assigneeId && s.assigneeId === user?.id;
  });

  // Banner — at most one, priority: viewer's own stage (actionable, then waiting), else requester.
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
          ? `${STAGE_LABELS[stage]} is yours. Mark it complete when you're done — the owner can then mark this change request implemented.`
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
      text: `This is your request. It was approved on ${formatDate(data.updatedAt)} and is now being built. You'll be notified when it's deployed.`,
    };
  }

  const description = data.description || '';
  const showDescToggle = description.length > 220;

  return (
    <Box>
      <BackButton />

      <Paper variant="outlined" sx={{ p: 2, mt: 1, mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap rowGap={1}>
          <Typography variant="h5" fontWeight={700}>{data.title}</Typography>
          <Stack direction="row" alignItems="center" spacing={1}>
            <StatusBadge color={chip.color} label={chip.label} />
            {readyToImplement && isOwnerOrSuper && (
              <Button size="small" variant="contained" disabled={submitting} onClick={() => setConfirmingImplement(true)}>
                Implemented
              </Button>
            )}
          </Stack>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {data.requester?.name || 'Unknown user'} · requested {formatDate(data.createdAt)}
        </Typography>
        {data.source?.type && (
          <Typography variant="caption" sx={{ display: 'block', mt: 0.25 }}>
            <Link component={RouterLink} to={data.source.url} color="text.secondary" sx={{ '&:hover': { textDecoration: 'underline' } }}>
              {data.source.type === 'feature_request' ? `From feature request #${data.source.number}` : 'From a reported issue'}
            </Link>
          </Typography>
        )}
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
              canAssign={canAssignStage(stageData)}
              canAct={canActOnStage(stageData)}
              canWriteNotes={canWriteNotesOnStage(stageData)}
              isViewerStage={index === viewerStageIndex}
              isRequestReady={isRequestReady}
              isBlockedByPredecessor={isBlockedByPredecessor}
              predecessorLabel={predecessor ? STAGE_LABELS[predecessor.stage] : null}
              predecessorAssigneeName={predecessor?.assignee?.name}
              candidates={candidates}
              submitting={submitting}
              onStart={() => patchStage(stage, { status: 'in_progress' }, `${STAGE_LABELS[stage]} started`)}
              onAssign={(payload) => handleAssignStage(stage, payload)}
              onOpenComplete={() => setCompletingStage(stage)}
            />
          );
        })}
      </Stack>

      <ConfirmYesNoDialog
        open={!!completingStage}
        title="Are you sure Mark as Complete?"
        submitting={submitting}
        onClose={() => setCompletingStage(null)}
        onConfirm={() => handleMarkComplete(completingStage)}
      />
      <ConfirmYesNoDialog
        open={confirmingImplement}
        title="Are you sure you want to mark this implemented?"
        submitting={submitting}
        onClose={() => setConfirmingImplement(false)}
        onConfirm={handleImplement}
      />
    </Box>
  );
}

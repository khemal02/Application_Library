import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { alpha } from '@mui/material/styles';
import dayjs from 'dayjs';
import { applicationTrackingApi, attachmentsApi } from '../../services/domains';
import { useAppSelector } from '../../app/hooks';
import useResource from '../../hooks/useResource';
import useBreadcrumbLabel from '../../hooks/useBreadcrumbLabel';
import useToast from '../../hooks/useToast';
import usePermission from '../../routes/usePermission';
import { LoadingBlock, ErrorBlock } from '../../components/common/AsyncState';
import StatusBadge from '../../components/common/StatusBadge';
import BackButton from '../../components/common/BackButton';
import NotesThread from '../../components/common/NotesThread';
import AccordionSection from '../../components/common/AccordionSection';
import { STAGE_ORDER, STAGE_LABELS, STAGE_STATUS_LABELS, deriveStatusChip,
} from '../../utils/applicationTrackStatus';

const formatDate = (value) => (value ? dayjs(value).format('MMM D, YYYY') : '—');

const NOTES_CANCELLED_REASON = 'This track was cancelled — its stages are no longer open for notes.';

const CAPTION_SX = {
  display: 'block', textTransform: 'uppercase', letterSpacing: '.07em', color: 'text.disabled',
};

function ReadField({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" sx={CAPTION_SX}>{label}</Typography>
      {/* component="div" — `value` can be a block-level element (DocumentLinks' Stack), which is
          invalid inside Typography's default <p>. */}
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

/** Same +/- accordion IdeaDetailPage.jsx uses for these three fields (AccordionSection, shared) —
 * read-only here, since the idea behind an already-approved track is frozen and never edited from
 * this page. */
function IdeaFieldAccordion({ label, value, defaultOpen }) {
  return (
    <AccordionSection title={label} defaultOpen={defaultOpen}>
      <Typography sx={{ fontSize: '13.3px', color: '#374151', lineHeight: 1.65, whiteSpace: 'pre-wrap', textAlign: 'justify' }}>
        {value || '—'}
      </Typography>
    </AccordionSection>
  );
}

/** A plain Yes/No confirmation prompt — reused for "Mark {Stage} complete", "Move to Application",
 * and "Move to {next stage}", the only difference being the question asked. */
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

/** "Send back to {previous stage}" — unlike the plain Yes/No dialogs above, this one requires a
 * reason: the confirm button stays disabled until something is actually typed, same as
 * ChangeRequestDetailPage.jsx's own SendBackDialog. */
function SendBackDialog({
  open, stage, onClose, onConfirm, submitting,
}) {
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) setReason(''); }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>What didn&apos;t work?</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus fullWidth multiline minRows={3} label="Reason (required)"
          value={reason} onChange={(e) => setReason(e.target.value)}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button
          variant="contained" color="warning" disabled={submitting || !reason.trim()}
          onClick={() => onConfirm(reason.trim())}
        >
          Send back to {stage ? STAGE_LABELS[stage] : ''}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Minimal activity/timeline list beneath the three stage sections — one line per status_history
 * entry, its timestamp, and the actor. A send-back entry carries a `note` (the reason — the only
 * thing that ever populates that column, see applicationTracking.service.js's sendBackStage), so
 * its presence alone is what triggers the distinct warning styling; every other transition in this
 * module always writes `note: null`. Mirrors ChangeRequestDetailPage.jsx's own ActivityTimeline. */
function describeTransition(entry) {
  const parseStagePart = (value) => {
    const [stage, status] = (value || '').split(': ');
    return STAGE_ORDER.includes(stage) ? { stage, status } : null;
  };
  const from = parseStagePart(entry.fromStatus);
  const to = parseStagePart(entry.toStatus);
  if (to && from && to.stage === from.stage) {
    return `${STAGE_LABELS[to.stage]}: ${STAGE_STATUS_LABELS[from.status] || from.status} → ${STAGE_STATUS_LABELS[to.status] || to.status}`;
  }
  if (to) {
    return `${STAGE_LABELS[to.stage]} started`;
  }
  // Not a per-stage transition — the track's own governance status changed instead (e.g. priority,
  // or active -> on_hold/cancelled/live).
  return `${entry.fromStatus || 'Created'} → ${entry.toStatus}`;
}

function ActivityTimeline({ history }) {
  if (!history || history.length === 0) return null;
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Activity</Typography>
      <Stack spacing={0}>
        {history.map((entry, idx) => (
          <Box
            key={entry.id}
            sx={{
              py: 1,
              ...(idx < history.length - 1 ? { borderBottom: 1, borderColor: 'divider' } : {}),
              ...(entry.note ? { bgcolor: (theme) => alpha(theme.palette.warning.main, 0.08) } : {}),
            }}
          >
            <Stack direction="row" spacing={1} alignItems="baseline" flexWrap="wrap" useFlexGap>
              {entry.note && <RestartAltIcon fontSize="small" color="warning" />}
              <Typography variant="body2" fontWeight={entry.note ? 700 : 400} color={entry.note ? 'warning.dark' : 'text.primary'}>
                {describeTransition(entry)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {entry.changedByUser?.name || 'Unknown'} · {dayjs(entry.createdAt).format('MMM D, YYYY, h:mm A')}
              </Typography>
            </Stack>
            {entry.note && (
              <Typography variant="body2" color="warning.dark" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                &ldquo;{entry.note}&rdquo;
              </Typography>
            )}
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}

/**
 * One of the three stacked sections. Started is editable (and Save shows up) for the owner/
 * assignee/super-admin at ANY status, not just in_progress — the owner can plan every stage's
 * start right after the track is created, laying out the whole timeline before Development even
 * starts. Document link stays narrower (assignee-only, in_progress-only — see linkEditable) since
 * it's a real deliverable, not a plan. A complete stage is always plain text, no inputs. Never a
 * disabled action BUTTON (1c/Stage 4 style rule) — canAct=false renders zero buttons, in any mode,
 * rather than greying them out. Assignee is its own inline select, right here in the card — no
 * separate "Assign the work" rail anymore; picking a name commits immediately, together with
 * Started, via the same Assignee button.
 *
 * The chip is assignee-aware, same as ChangeRequestDetailPage.jsx's StageCard: the person actually
 * assigned to THIS stage sees "Your turn" / "Waiting on {predecessor's assignee}" instead of the
 * generic Not started/In progress/Complete label — everyone else still sees the generic one.
 */
function StageSection({
  stage, stageData, canAct, canAssign, candidates, canWriteNotes, isBlockedByPredecessor, predecessorLabel, predecessorAssigneeName,
  hasPreviousStage, hasNextStage, nextStageLabel,
  trackStartDate, trackTargetGoLive, isViewerStage, isRequestReady, trackStatus, onStart, onSaveDates, onAssign, onOpenComplete,
  onOpenAdvance, onOpenSendBack, submitting,
}) {
  const isComplete = stageData.status === 'complete';
  const isInProgress = stageData.status === 'in_progress';
  // Owner/super-admin only — same reasoning as canAssign, not canAct: planning Started is the
  // owner's job (same person who names the assignee), not the assignee's own to edit. Reuses
  // canAssign's exact condition rather than duplicating it — the two are the same permission
  // scope. Deliberately NOT gated on isInProgress either — the owner can plan every stage's start
  // right after the track is created, laying out the whole Development -> Testing -> Deployment
  // timeline before any of them actually begin. Only a completed stage locks this back down to a
  // historical record (canAssign already excludes complete stages).
  const datesEditable = canAssign;
  // Narrower than datesEditable — the document link is the assignee's own deliverable to attach,
  // same reasoning canWriteNotesOnStage already applies to Notes: the owner doesn't get a pass here
  // just for being able to start/complete the stage, and it's only meaningful once work is
  // actually under way.
  const linkEditable = isInProgress && canWriteNotes;
  const [assigning, setAssigning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  const [startDraft, setStartDraft] = useState(stageData.startDate || '');
  const [assigneeDraft, setAssigneeDraft] = useState(stageData.assigneeId || '');
  useEffect(() => {
    setStartDraft(stageData.startDate || '');
  }, [stageData.startDate]);
  // Deliberately its own effect, not folded into the one above — saving dates (Save button) must
  // never wipe out an assignee the owner already picked but hasn't confirmed yet via the
  // "Assignee" button. This one only resyncs when the stage's STORED assigneeId itself changes
  // (i.e. after a real commit, or someone else's edit coming in via reload).
  useEffect(() => {
    setAssigneeDraft(stageData.assigneeId || '');
  }, [stageData.assigneeId]);

  // The current assignee might not be in the active-candidates list any more (e.g. deactivated,
  // or a role change that dropped their eligibility) — same fallback AssignCard used to apply, so
  // the select still shows who's actually assigned instead of rendering blank.
  const assigneeOptions = (!stageData.assigneeId || candidates.some((c) => c.id === stageData.assigneeId))
    ? candidates
    : [{ id: stageData.assigneeId, name: stageData.assignee?.name, roleLabel: null }, ...candidates];

  // "Assignee" only enables once every field it commits is actually filled in — name AND Started.
  // Picking "Unassigned" keeps it disabled too, same as leaving the name blank — there's no
  // exception for clearing an existing assignment through this button.
  const needsDatesFirst = !!assigneeDraft && !startDraft;
  const assigneeDirty = canAssign && !!assigneeDraft && !!startDraft;
  const confirmAssign = async () => {
    setAssigning(true);
    try {
      // Carries the draft Started date along with the assignment — this is now the ONLY way the
      // owner's Started date ever gets persisted, there's no separate Save for it any more.
      await onAssign({
        assigneeId: assigneeDraft || null,
        ...(assigneeDraft && datesEditable ? { startDate: startDraft || null } : {}),
      });
    } finally {
      setAssigning(false);
    }
  };

  // A planned date is the owner's own draft of a stage nobody's picked up yet — showing it to every
  // viewer before anyone's actually assigned made an unassigned stage look like it already had a
  // start in motion. The owner still sees their own plan (they're the one editing it); everyone
  // else sees "—" for these fields until the stage genuinely has an assignee, same as the Assignee
  // field itself already reads while unassigned.
  const datesVisible = !!stageData.assigneeId || canAssign;

  // ISO 'YYYY-MM-DD' strings sort correctly lexicographically, so plain string min/max works here
  // without parsing into real Date objects. Bounded by the track's own overall window — Started
  // can't be planned before the track's own Start Date or after its Expected Deployment Date.
  const startMin = trackStartDate || undefined;
  const startMax = trackTargetGoLive || undefined;

  // There's no "Save" button anywhere on this card any more. The owner's Started date
  // only ever commits together with the Assignee button (confirmAssign carries the draft date
  // along); the assignee's Document Link now commits itself the moment a file finishes uploading —
  // picking the file IS the confirm action, so there's nothing left standing around to "save".
  const handleDocumentUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError('');
    setUploading(true);
    try {
      const uploaded = await attachmentsApi.upload('application_track_stage', stageData.id, file);
      await onSaveDates({ documentUrl: uploaded.data.url });
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
            <ReadField label="Assignee" value={stageData.assignee?.name} />
          )}
        </Grid>
        <Grid item xs={6} sm={3}>
          {/* Locked during submitting/assigning — dates now commit only via the Assignee button, so
              its own in-flight state is what could otherwise race an in-progress edit here, same
              reasoning the Assignee dropdown's own disabled={assigning} already covers. */}
          {datesEditable ? (
            <TextField
              fullWidth size="small" label="Started" type="date" InputLabelProps={{ shrink: true }}
              value={startDraft} disabled={submitting || assigning}
              onChange={(e) => setStartDraft(e.target.value)}
              inputProps={{ min: startMin, max: startMax }}
            />
          ) : (
            <ReadField label="Started" value={datesVisible ? formatDate(stageData.startDate) : null} />
          )}
        </Grid>
        <Grid item xs={6} sm={3}>
          <ReadField label="Finished date" value={datesVisible ? formatDate(stageData.finishedDate) : null} />
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
        {/* Not started yet — whether blocked on the predecessor or simply not yet started — means
            there's no work in motion to log a note about. Opens the moment the assignee actually
            clicks Start, same as the assignee's own action buttons below. */}
        <NotesThread
          entityType="application_track_stage"
          entityId={stageData.id}
          title="Notes"
          emptyLabel="No notes yet."
          disabled={!canWriteNotes || trackStatus === 'cancelled' || stageData.status === 'not_started'}
          disabledReason={trackStatus === 'cancelled' ? NOTES_CANCELLED_REASON : (stageData.status === 'not_started' ? 'Notes open once this stage has started.' : '')}
          hideAuthor
          hideDate
          plain
          editableOwn
        />
      </Box>

      {canAct && isRequestReady && (
        <Box sx={{ mt: 2 }}>
          {/* A stage with a previous stage can no longer be started manually at all — see the
              button logic below — so while it's not_started there's nothing to click here, only
              this line. A stage with NO previous stage (development) never shows this: it has its
              own Start button instead, unchanged. */}
          {stageData.status === 'not_started' && hasPreviousStage && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Waiting on {predecessorLabel}.
            </Typography>
          )}
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap rowGap={1}>
            <Stack direction="row" spacing={1}>
              {/* Starting the stage is the assignee's own call (or a super-admin's), not the
                  owner's, unless the owner is themselves the assignee — same reasoning
                  canWriteNotes already applies to Notes. Only development (no previous stage) still
                  has a manual Start — every other stage only ever starts as a side effect of the
                  previous stage's own "Move to" action (see hasNextStage's Move-to button below on
                  THAT stage's own card). */}
              {!hasPreviousStage && canWriteNotes && !isComplete && (
                <Button
                  variant="contained"
                  disabled={submitting || stageData.status !== 'not_started' || isBlockedByPredecessor}
                  onClick={onStart}
                >
                  Start {STAGE_LABELS[stage]}
                </Button>
              )}
              {canAssign && (
                <Tooltip title={needsDatesFirst ? 'Set Started before assigning someone.' : ''}>
                  <span>
                    <Button variant="contained" disabled={assigning || !assigneeDirty || needsDatesFirst} onClick={confirmAssign}>
                      Assignee
                    </Button>
                  </span>
                </Tooltip>
              )}
              {/* Warning-toned, deliberately not primary — this is the one place a stage can move
                  backward, and it must never be confusable with the forward Move/Mark-complete
                  actions next to it. */}
              {hasPreviousStage && isInProgress && canWriteNotes && (
                <Button
                  variant="outlined" color="warning" startIcon={<RestartAltIcon />}
                  disabled={submitting}
                  onClick={onOpenSendBack}
                >
                  Something didn&apos;t work — send back to {predecessorLabel}
                </Button>
              )}
            </Stack>
            {/* Same assignee-or-super gate as "Start" above — the owner doesn't get a pass here
                either, unless they're themselves the assignee. Once complete, there's nothing left
                to mark, so it disappears entirely (matches a finished stage showing no action
                buttons at all, just its status). */}
            {canWriteNotes && !isComplete && (
              hasNextStage ? (
                <Button variant="contained" disabled={submitting || !isInProgress} onClick={onOpenAdvance}>
                  Move to {nextStageLabel} →
                </Button>
              ) : (
                <Button variant="contained" disabled={submitting || !isInProgress} onClick={onOpenComplete}>
                  Mark {STAGE_LABELS[stage]} complete
                </Button>
              )
            )}
          </Stack>
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
  const [advancingStage, setAdvancingStage] = useState(null);
  const [sendingBackStage, setSendingBackStage] = useState(null);
  const [confirmingGoLive, setConfirmingGoLive] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [history, setHistory] = useState([]);

  useBreadcrumbLabel(track?.name);

  useEffect(() => {
    applicationTrackingApi.assigneeCandidates(id)
      .then((res) => setCandidates(res.data))
      .catch(() => setCandidates([]));
  }, [id]);

  // Loaded once up front, then re-loaded alongside `reload()` after any action that can write a
  // status_history row (start/complete/advance/send-back/go-live) — same "never patch local state,
  // always refetch and re-render from the response" rule the track itself follows.
  const loadHistory = () => {
    applicationTrackingApi.statusHistory(id)
      .then((res) => setHistory(res.data))
      .catch(() => setHistory([]));
  };
  useEffect(loadHistory, [id]);

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
  // Same rule the old "Assign the work" rail enforced, just checked per stage now instead of
  // gating the whole card: only the owner (or a super-admin) may assign, a dead/delivered track
  // (cancelled/live) has nothing left to assign, and a completed stage keeps whoever did it.
  const canAssignStage = (stageData) => isOwnerOrSuper && track.status !== 'cancelled' && track.status !== 'live'
    && stageData.status !== 'complete';

  const patchStage = async (stage, payload, successMessage) => {
    setSubmitting(true);
    try {
      await applicationTrackingApi.updateStage(id, stage, payload);
      showSuccess(successMessage);
      await reload();
      loadHistory();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to update stage');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkComplete = async (stage) => {
    setSubmitting(true);
    try {
      await applicationTrackingApi.updateStage(id, stage, { status: 'complete' });
      showSuccess(`${STAGE_LABELS[stage]} complete`);
      setCompletingStage(null);
      await reload();
      loadHistory();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to complete the stage');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdvance = async (stage) => {
    setSubmitting(true);
    try {
      await applicationTrackingApi.advanceStage(id, stage);
      showSuccess(`Moved to ${STAGE_LABELS[STAGE_ORDER[STAGE_ORDER.indexOf(stage) + 1]]}`);
      setAdvancingStage(null);
      await reload();
      loadHistory();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to move to the next stage');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendBack = async (stage, reason) => {
    setSubmitting(true);
    try {
      await applicationTrackingApi.sendBackStage(id, stage, reason);
      showSuccess(`Sent back to ${STAGE_LABELS[STAGE_ORDER[STAGE_ORDER.indexOf(stage) - 1]]}`);
      setSendingBackStage(null);
      await reload();
      loadHistory();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to send this back');
    } finally {
      setSubmitting(false);
    }
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

  const handleGoLive = async () => {
    setSubmitting(true);
    try {
      await applicationTrackingApi.goLive(id);
      showSuccess('Application registered — this track is now live');
      setConfirmingGoLive(false);
      await reload();
      loadHistory();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to move this track live');
    } finally {
      setSubmitting(false);
    }
  };

  // `payload` carries assigneeId and, when the owner is naming someone rather than clearing the
  // assignment, whatever dates were in the draft at the moment "Assignee" was clicked — see
  // StageSection#confirmAssign.
  const handleAssignStage = async (stage, payload) => {
    try {
      await applicationTrackingApi.updateStage(id, stage, payload);
      showSuccess('Assignee updated');
      await reload();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to update assignee');
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
          : `${STAGE_LABELS[stage]} is yours. When you're done, move it to ${STAGE_LABELS[STAGE_ORDER[viewerStageIndex + 1]]}${nextName ? ` for ${nextName}` : ''} to pick up.`,
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

      <Box sx={{ mt: 1, mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap rowGap={1}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography fontWeight={800} sx={{ fontSize: '24px' }}>{track.name}</Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1}>
            <StatusBadge color={chip.color} label={chip.label} />
            {isOwnerOrSuper && track.status === 'on_hold' && (
              <Button size="small" variant="contained" onClick={handleResume} disabled={submitting}>Resume</Button>
            )}
          </Stack>
        </Stack>
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
        {(track.startDate || track.targetGoLive) && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Track window: {formatDate(track.startDate)} – {formatDate(track.targetGoLive)}
          </Typography>
        )}
      </Box>

      {track.idea && (
        <Box sx={{ mb: 2 }}>
          <IdeaFieldAccordion label="Problem Statement" value={track.idea.description} defaultOpen />
          <IdeaFieldAccordion label="Proposed Solution" value={track.idea.proposedSolution} defaultOpen />
          <IdeaFieldAccordion label="Technologies" value={track.idea.technologiesAndEfficiency} defaultOpen />
        </Box>
      )}

      <Stack spacing={1.5}>
        {readyToGoLive && isOwnerOrSuper && (
          <Alert
            severity="success"
            action={(
              <Button size="small" variant="contained" disabled={submitting} onClick={() => setConfirmingGoLive(true)}>
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
                canAssign={canAssignStage(stageData)}
                candidates={candidates}
                canWriteNotes={canWriteNotesOnStage(stageData)}
                trackStartDate={track.startDate}
                trackTargetGoLive={track.targetGoLive}
                isViewerStage={index === viewerStageIndex}
                isRequestReady={isActive}
                trackStatus={track.status}
                isBlockedByPredecessor={isBlockedByPredecessor}
                predecessorLabel={predecessor ? STAGE_LABELS[predecessor.stage] : null}
                predecessorAssigneeName={predecessor?.assignee?.name}
                hasPreviousStage={index > 0}
                hasNextStage={index < STAGE_ORDER.length - 1}
                nextStageLabel={index < STAGE_ORDER.length - 1 ? STAGE_LABELS[STAGE_ORDER[index + 1]] : null}
                submitting={submitting}
                onStart={() => patchStage(stage, { status: 'in_progress' }, `${STAGE_LABELS[stage]} started`)}
                onSaveDates={(payload) => patchStage(stage, payload, 'Saved')}
                onAssign={(payload) => handleAssignStage(stage, payload)}
                onOpenComplete={() => setCompletingStage(stage)}
                onOpenAdvance={() => setAdvancingStage(stage)}
                onOpenSendBack={() => setSendingBackStage(stage)}
              />
            </Box>
          );
        })}
      </Stack>

      {history.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <ActivityTimeline history={history} />
        </Box>
      )}

      <ConfirmYesNoDialog
        open={!!completingStage}
        title="Are you sure Mark as Complete?"
        submitting={submitting}
        onClose={() => setCompletingStage(null)}
        onConfirm={() => handleMarkComplete(completingStage)}
      />
      <ConfirmYesNoDialog
        open={!!advancingStage}
        title={advancingStage
          ? `Are you sure you want to move to ${STAGE_LABELS[STAGE_ORDER[STAGE_ORDER.indexOf(advancingStage) + 1]]}?`
          : ''}
        submitting={submitting}
        onClose={() => setAdvancingStage(null)}
        onConfirm={() => handleAdvance(advancingStage)}
      />
      <SendBackDialog
        open={!!sendingBackStage}
        stage={sendingBackStage ? STAGE_ORDER[STAGE_ORDER.indexOf(sendingBackStage) - 1] : null}
        submitting={submitting}
        onClose={() => setSendingBackStage(null)}
        onConfirm={(reason) => handleSendBack(sendingBackStage, reason)}
      />
      <ConfirmYesNoDialog
        open={confirmingGoLive}
        title="Are you sure you want to move to application?"
        submitting={submitting}
        onClose={() => setConfirmingGoLive(false)}
        onConfirm={handleGoLive}
      />
    </Box>
  );
}

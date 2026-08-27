import { useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import dayjs from 'dayjs';
import { ideasApi } from '../../services/domains';
import { useAppSelector } from '../../app/hooks';
import useToast from '../../hooks/useToast';
import avatarColor from '../../utils/avatarColor';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PanelPickerDialog from './PanelPickerDialog';

// A reviewer's advisory verdict has three tiers; an approver's (or the CEO tie-break's) binding
// vote stays strictly binary — see ideas.validator.js#submitReview for why.
const REVIEWER_LABELS = { approve: 'Fully supported', request_changes: 'Partially supported', reject: 'Not supported' };
const APPROVER_LABELS = { approve: 'Approved', reject: 'Rejected' };

/**
 * Change 10's exact vocabulary — no lock/gated state anymore: reviewers and approvers act fully
 * in parallel, so a null approver decision only ever means "hasn't voted yet," never "blocked."
 */
function VerdictChip({ kind, decision }) {
  const labels = kind === 'reviewer' ? REVIEWER_LABELS : APPROVER_LABELS;
  if (decision === 'approve') return <Chip size="small" color="success" label={labels.approve} />;
  if (decision === 'request_changes') return <Chip size="small" color="warning" label={labels.request_changes} />;
  if (decision === 'reject') return <Chip size="small" color="error" label={labels.reject} />;
  return <Chip size="small" variant="outlined" label={kind === 'reviewer' ? 'Awaiting response' : 'Awaiting decision'} />;
}

/**
 * One compact row — avatar, name (role beneath, "· you" on the viewer's own row, and — only once
 * they've actually voted — the vote's date on its own line under that), a flexible spacer, the
 * verdict chip, and `✕` only when removable. "Added by … on …" is a tooltip on the name, not its
 * own line. A note, when there is one, still gets its own line, indented under the name.
 */
function PanelRow({ entry, isMe, onRemove }) {
  const tooltip = entry.addedBy ? `Added by ${entry.addedBy.name} on ${dayjs(entry.addedAt).format('MMM D, YYYY')}` : '';
  return (
    <Box sx={{ py: 1 }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Avatar sx={{ width: 32, height: 32, flex: '0 0 32px', fontSize: 14, bgcolor: avatarColor(entry.userId), color: '#fff' }}>
          {entry.name?.[0]}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Tooltip title={tooltip} disableHoverListener={!tooltip}>
            <Typography variant="body2" fontWeight={600} noWrap sx={{ display: 'inline-block', maxWidth: '100%', cursor: tooltip ? 'help' : 'default' }}>
              {entry.name}
            </Typography>
          </Tooltip>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {entry.role}{isMe ? ' · you' : ''}{entry.reviewedAt ? ` · Voted ${dayjs(entry.reviewedAt).format('MMM D, YYYY, h:mm A')}` : ''}
          </Typography>
        </Box>
        <VerdictChip kind={entry.kind} decision={entry.decision} />
        {entry.canRemove && (
          <IconButton size="small" aria-label={`Remove ${entry.name}`} onClick={() => onRemove(entry)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>
      {entry.note && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, ml: '44px', whiteSpace: 'pre-wrap' }}>{entry.note}</Typography>
      )}
    </Box>
  );
}

/**
 * The open review panel — any number of REVIEWERS (advisory, R2: never move the idea) and any
 * number of APPROVERS, acting fully in PARALLEL with reviewers — an approver never waits on
 * reviewers to respond (that gate existed briefly and was removed at your request). R1 is
 * majority-rule, not unanimous-plus-veto: every approver votes, and once they all have, whichever
 * side has more wins. A TIE doesn't resolve on its own: any active CEO can cast a deciding vote
 * (`panel.canTieBreak`) that becomes the outcome directly, without needing to be on the panel
 * first.
 *
 * UI pass (RICC prompt): fixes the form defaulting to a decision nobody picked, replaces the
 * dropdown with two labelled radio-card options, states who the viewer is and what their click
 * actually does. See this conversation's report for the places the prompt's own description of
 * R1 was stale (it predates the majority/tie-break rule) and how the approver consequence/confirm
 * copy was adapted to stay accurate rather than reproduce the "any reject ends it" framing that's
 * no longer true.
 */
export default function IdeaPanelCard({
  idea, panel,
  voteDecision, onVoteDecisionChange, voteNote, onVoteNoteChange,
  ownerId, onOwnerIdChange, ownerCandidates,
  submitting, onSubmitReview,
  onPanelChanged,
}) {
  const user = useAppSelector((s) => s.auth.user);
  const { showSuccess, showError } = useToast();
  const [pickerKind, setPickerKind] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [editingMyResponse, setEditingMyResponse] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);

  if (!panel) return null;

  const isDecided = idea.status === 'approved' || idea.status === 'rejected';
  const myRow = panel.myRow;
  const isApproverRow = myRow?.kind === 'approver';
  const isTieBreak = panel.canTieBreak; // a CEO breaking a tie — not a normal panel row at all

  // My own roster entry carries the timestamp myRow itself doesn't (myRow is the lightweight
  // "can I act" shape) — reused for the recorded-response view (Change 8) instead of adding a
  // field to the API response for it.
  const myRosterEntry = [...panel.reviewers, ...panel.approvers].find((e) => e.userId === user?.id);
  const hasRecordedResponse = myRow && myRow.decision !== null && !isTieBreak;

  // Am I the one remaining approver vote, and — if so — does the FULL tally (including whatever
  // I currently have selected) actually favor one side? Computed client-side from the same panel
  // data the backend sent. A tie-break's own vote always directly IS the outcome — no tally.
  const otherApprovers = isApproverRow ? panel.approvers.filter((a) => a.userId !== user?.id) : [];
  const isCompletingVote = isApproverRow && otherApprovers.every((a) => a.decision !== null);
  const approveTally = otherApprovers.filter((a) => a.decision === 'approve').length + (voteDecision === 'approve' ? 1 : 0);
  const rejectTally = otherApprovers.filter((a) => a.decision === 'reject').length + (voteDecision === 'reject' ? 1 : 0);
  const wouldTie = isApproverRow && isCompletingVote && approveTally === rejectTally;
  const completingOutcome = isCompletingVote ? (wouldTie ? 'tie' : (approveTally > rejectTally ? 'approve' : 'reject')) : null;
  const wouldDecideApprove = isTieBreak ? voteDecision === 'approve' : (completingOutcome === 'approve');

  const isNewIdeaUnregistered = idea.category === 'new_idea' && !idea.applicationId; // D4's lane test, reused verbatim
  const requiresOwner = wouldDecideApprove && isNewIdeaUnregistered;
  const applicationName = idea.application?.name || 'the existing application';

  // Only the vote that will ACTUALLY finalize the idea as Rejected gets the "cannot be undone"
  // confirmation — under majority rule a non-completing reject is just one recorded opinion among
  // several still-open votes, not remotely final, so treating every reject click as catastrophic
  // would be its own false-consequence bug of the exact kind this pass exists to fix.
  const isTerminalRejectSubmit = voteDecision === 'reject' && ((isApproverRow && completingOutcome === 'reject') || isTieBreak);

  const showVoteForm = (myRow?.canAct && (!hasRecordedResponse || editingMyResponse)) || isTieBreak;

  const kicker = isTieBreak ? 'YOU ARE THE CEO — TIE-BREAK' : (isApproverRow ? 'YOU ARE AN APPROVER' : 'YOU ARE A REVIEWER');

  // An approver's or the CEO tie-break's vote is binding, so it stays a strict two-way choice. A
  // reviewer's is advisory (R2: never ends anything) and gets a third, middle tier instead.
  const isBinaryVote = isApproverRow || isTieBreak;
  const voteOptions = isBinaryVote
    ? [
      { value: 'approve', title: 'Approve' },
      { value: 'reject', title: 'Reject' },
    ]
    : [
      { value: 'approve', title: 'Fully supported' },
      { value: 'request_changes', title: 'Partially supported' },
      { value: 'reject', title: 'Not supported' },
    ];

  const doSubmit = async () => {
    const ok = await onSubmitReview();
    if (ok) setEditingMyResponse(false);
    setConfirmReject(false);
  };

  const handleSubmitClick = () => {
    if (isTerminalRejectSubmit) { setConfirmReject(true); return; }
    doSubmit();
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await ideasApi.removeParticipant(idea.id, removeTarget.userId);
      showSuccess(`${removeTarget.name} removed from the panel`);
      setRemoveTarget(null);
      await onPanelChanged();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to remove participant');
    } finally {
      setRemoving(false);
    }
  };

  // Change 5 — one accurate sentence for whatever is actually about to happen. Kept as a function
  // (not JSX inline) because the approver branch genuinely has four distinct cases and inlining it
  // was unreadable.
  function consequence() {
    if (!isApproverRow && !isTieBreak) {
      return null; // reviewers get no consequence line — their verdict never has one to state
    }
    if (isTieBreak) {
      if (!voteDecision) return null;
      if (voteDecision === 'reject') return { severity: 'warning', text: 'Rejecting ends this idea immediately.' };
      return {
        severity: 'info',
        text: `Approving ends the tie in favor of the idea${isNewIdeaUnregistered ? ' and registers a tracked Application' : ` and attaches it to ${applicationName}`}.`,
      };
    }
    if (!isCompletingVote) {
      const stillToVote = otherApprovers.filter((a) => a.decision === null).length;
      return {
        severity: 'info',
        text: `You are 1 of ${panel.approversTotal} approvers. ${stillToVote} more still need to vote — the idea is decided by majority once everyone has.`,
      };
    }
    if (!voteDecision) {
      return { severity: 'info', text: 'You are the last of the approvers to vote — your choice decides the outcome.' };
    }
    if (completingOutcome === 'tie') {
      return { severity: 'warning', text: `You are the last of ${panel.approversTotal} approvers. Right now this would tie ${approveTally}–${rejectTally} — the CEO would need to break it.` };
    }
    if (completingOutcome === 'approve') {
      return {
        severity: 'info',
        text: `You are the last of ${panel.approversTotal} approvers. Approving registers a tracked Application and freezes this idea — no further comments or edits.`,
      };
    }
    return { severity: 'warning', text: `You are the last of ${panel.approversTotal} approvers. Rejecting ends this idea immediately — no further comments or edits.` };
  }
  const consequenceInfo = showVoteForm ? consequence() : null;

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle2" fontWeight={700}>Review panel</Typography>
        {isDecided ? (
          <Chip size="small" color={idea.status === 'approved' ? 'success' : 'error'} label={idea.status === 'approved' ? 'Approved' : 'Rejected'} />
        ) : (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="text.secondary">
              Reviewers {panel.reviewersResponded}/{panel.reviewersTotal} · Approvers {panel.approversApproved}/{panel.approversTotal}
            </Typography>
            {panel.isTied && <Chip size="small" color="warning" label="Tied" />}
          </Stack>
        )}
      </Stack>

      {panel.reviewersTotal === 0 && panel.approversTotal === 0 && !isDecided && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          No Reviewers and Approvers have been added yet.
        </Alert>
      )}

      {/* Your own action sits above the roster, not buried below it. */}
      {panel.isTied && !isTieBreak && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Tied {panel.approversApproved}–{panel.approversRejected} — the CEO needs to break the tie before this idea can be decided.
        </Alert>
      )}

      {hasRecordedResponse && !editingMyResponse && myRosterEntry && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="success" sx={{ mb: 1 }}>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
              Your recorded {isApproverRow ? 'decision' : 'review'}:{' '}
              <VerdictChip kind={myRosterEntry.kind} decision={myRosterEntry.decision} />
            </Typography>
            {myRosterEntry.note && (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{myRosterEntry.note}</Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {dayjs(myRosterEntry.reviewedAt).format('MMM D, YYYY, h:mm A')}
            </Typography>
          </Alert>
          {/* Not shown once tied (myRow.canAct is false there, same as a gated approver) —
              resolution at that point is the CEO's tie-break, not a quiet re-vote, even though
              the backend would technically still accept an amendment. Out of scope for this UI
              pass to change; see the report. */}
          {myRow.canAct && (
            <Button size="small" onClick={() => setEditingMyResponse(true)}>
              {isApproverRow ? 'Update decision' : 'Update review'}
            </Button>
          )}
        </Box>
      )}

      {showVoteForm && (
        <Box sx={{ mb: 2, p: 1.5, border: 1, borderColor: 'primary.main', borderRadius: 1 }}>
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ letterSpacing: 0.5 }}>
                {kicker}
              </Typography>
            </Box>

            <RadioGroup
              row={isBinaryVote} value={voteDecision} aria-label="Decision"
              onChange={(e) => onVoteDecisionChange(e.target.value)}
              sx={{ flexWrap: 'nowrap', gap: 1.5, width: '100%' }}
            >
              {voteOptions.map((opt) => (
                <FormControlLabel
                  key={opt.value}
                  value={opt.value}
                  control={<Radio size="small" sx={{ pt: '2px', alignSelf: 'flex-start' }} />}
                  label={<Typography variant="body2" fontWeight={700}>{opt.title}</Typography>}
                  sx={{ ...(isBinaryVote ? { flex: 1 } : { width: '100%' }), m: 0, alignItems: 'flex-start' }}
                />
              ))}
            </RadioGroup>

            {consequenceInfo && (
              <Alert severity={consequenceInfo.severity} sx={{ py: 0.5 }}>{consequenceInfo.text}</Alert>
            )}

            <TextField
              fullWidth size="small" multiline minRows={2} label="Note(Optional)" 
              value={voteNote} onChange={(e) => onVoteNoteChange(e.target.value)}
            />

            {requiresOwner && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Submitted by <strong>{idea.submitter?.name || '—'}</strong>
                </Typography>
                <TextField
                  select fullWidth size="small" label="Application Owner"
                  value={ownerId} onChange={(e) => onOwnerIdChange(e.target.value)}
                  helperText="Required — approving this will register a tracked Application."
                >
                  <MenuItem value="">Select…</MenuItem>
                  {ownerCandidates.map((u) => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
                </TextField>
              </Box>
            )}

            <Stack direction="row" spacing={1}>
              <Button
                variant="contained" disabled={submitting || !voteDecision || (requiresOwner && !ownerId)}
                onClick={handleSubmitClick}
              >
                {isTieBreak ? 'Break the Tie' : (isApproverRow ? (myRosterEntry?.decision ? 'Update decision' : 'Submit decision') : (myRosterEntry?.decision ? 'Update review' : 'Submit review'))}
              </Button>
              {editingMyResponse && (
                <Button onClick={() => {
                  // Discard the in-progress edit, not just the intent to edit — otherwise
                  // reopening "Update decision" later would show the abandoned draft instead of
                  // what's actually on record.
                  onVoteDecisionChange(myRosterEntry?.decision || '');
                  onVoteNoteChange(myRosterEntry?.note || '');
                  setEditingMyResponse(false);
                }}
                >
                  Cancel
                </Button>
              )}
            </Stack>
          </Stack>
        </Box>
      )}

      <Box sx={{ mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="body2" fontWeight={600}>Reviewers</Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="text.secondary">
              {panel.reviewersResponded} of {panel.reviewersTotal} responded
            </Typography>
            {panel.canManagePanel && (
              <Button size="small" startIcon={<AddIcon fontSize="small" />} onClick={() => setPickerKind('reviewer')}>Add</Button>
            )}
          </Stack>
        </Stack>
        {panel.reviewers.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>No reviewers added.</Typography>
        ) : (
          <Stack sx={{ mt: 1 }}>
            {panel.reviewers.map((entry) => (
              <PanelRow key={entry.userId} entry={entry} isMe={entry.userId === user?.id} onRemove={setRemoveTarget} />
            ))}
          </Stack>
        )}
      </Box>

      <Divider sx={{ mb: 2 }} />

      <Box sx={{ mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="body2" fontWeight={600}>Approvers</Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="text.secondary">
              {panel.approversApproved} approve · {panel.approversRejected} reject · {panel.approversTotal} total
            </Typography>
            {panel.canManagePanel && (
              <Button size="small" startIcon={<AddIcon fontSize="small" />} onClick={() => setPickerKind('approver')}>Add</Button>
            )}
          </Stack>
        </Stack>
        {panel.approvers.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>No approvers added.</Typography>
        ) : (
          <Stack sx={{ mt: 1 }}>
            {panel.approvers.map((entry) => (
              <PanelRow key={entry.userId} entry={entry} isMe={entry.userId === user?.id} onRemove={setRemoveTarget} />
            ))}
          </Stack>
        )}
        {panel.tiebreak && (
          <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Tied {panel.approversApproved}–{panel.approversRejected} — broken by the CEO:
            </Typography>
            <PanelRow entry={panel.tiebreak} isMe={panel.tiebreak.userId === user?.id} onRemove={() => {}} />
          </Box>
        )}
      </Box>

      <PanelPickerDialog
        open={!!pickerKind} kind={pickerKind} ideaId={idea.id}
        onClose={() => setPickerKind(null)}
        onAdded={async () => { setPickerKind(null); await onPanelChanged(); }}
      />

      <ConfirmDialog
        open={!!removeTarget}
        title={`Remove ${removeTarget?.name || 'this person'} from the panel?`}
        description="They can be added back later if needed."
        confirmLabel={removing ? 'Removing…' : 'Remove'}
        onConfirm={handleRemove}
        onClose={() => setRemoveTarget(null)}
      />

      <ConfirmDialog
        open={confirmReject}
        title="Reject this idea?"
        description="This finalizes the idea as Rejected and cannot be undone."
        confirmLabel="Reject idea"
        onConfirm={doSubmit}
        onClose={() => setConfirmReject(false)}
      />
    </Paper>
  );
}

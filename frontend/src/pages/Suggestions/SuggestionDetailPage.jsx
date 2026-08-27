import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import dayjs from 'dayjs';
import { suggestionsApi, usersApi } from '../../services/domains';
import { SUGGESTION_WORKFLOW_STEPS } from '../../constants/options';
import useResource from '../../hooks/useResource';
import useBreadcrumbLabel from '../../hooks/useBreadcrumbLabel';
import useToast from '../../hooks/useToast';
import { LoadingBlock, ErrorBlock } from '../../components/common/AsyncState';
import WorkflowStepper from '../../components/common/WorkflowStepper';
import StatusBadge from '../../components/common/StatusBadge';
import VoteButtons from '../../components/common/VoteButtons';
import CommentThread from '../../components/common/CommentThread';
import NotesThread from '../../components/common/NotesThread';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import BackButton from '../../components/common/BackButton';
import ReviewPanel from '../../components/common/ReviewPanel';
import humanize from '../../utils/humanize';

function Field({ label, value }) {
  if (!value) return null;
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{value}</Typography>
    </Box>
  );
}

// "closed" isn't a rejection, but it is the terminal state — worth one confirmation click so it
// isn't fired by an accidental misclick the way every other transition safely can be.
const CONFIRM_BEFORE = ['closed'];
const TERMINAL_STATUSES = ['rejected', 'closed'];

export default function SuggestionDetailPage() {
  const { id } = useParams();
  const [note, setNote] = useState('');
  const [assignee, setAssignee] = useState('');
  const [users, setUsers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [transitionError, setTransitionError] = useState(null);
  const [confirmStatus, setConfirmStatus] = useState(null);
  const [voteDecision, setVoteDecision] = useState('approve');
  const [voteNote, setVoteNote] = useState('');
  const [submittingVote, setSubmittingVote] = useState(false);
  const { showSuccess, showError } = useToast();

  const { data: suggestion, loading, error, reload } = useResource(() => suggestionsApi.getById(id), [id]);
  const { data: history } = useResource(() => suggestionsApi.statusHistory(id), [id]);
  useBreadcrumbLabel(suggestion?.title);

  const canActNow = (suggestion?.availableTransitions?.length ?? 0) > 0;

  useEffect(() => {
    if (!canActNow) return;
    usersApi.list({ limit: 100 }).then((res) => setUsers(res.data)).catch(() => setUsers([]));
  }, [canActNow]);

  useEffect(() => {
    if (!suggestion?.myReviewSlot) return;
    setVoteDecision(suggestion.myReviewSlot.decision || 'approve');
    setVoteNote(suggestion.myReviewSlot.note || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestion?.myReviewSlot?.decision, suggestion?.myReviewSlot?.note]);

  const runTransition = async (toStatus) => {
    setSubmitting(true);
    setTransitionError(null);
    try {
      await suggestionsApi.transition(id, { toStatus, note, ...(toStatus === 'assigned' ? { assignedTo: assignee } : {}) });
      setNote('');
      showSuccess(`Moved to ${humanize(toStatus)}`);
      await reload();
    } catch (err) {
      setTransitionError(err.response?.data?.message || 'Failed to update status');
    } finally {
      setSubmitting(false);
      setConfirmStatus(null);
    }
  };

  const handleTransitionClick = (status) => {
    if (CONFIRM_BEFORE.includes(status)) {
      setConfirmStatus(status);
    } else {
      runTransition(status);
    }
  };

  const handleSubmitReview = async () => {
    setSubmittingVote(true);
    try {
      await suggestionsApi.submitReview(id, { decision: voteDecision, note: voteNote || undefined });
      showSuccess('Review submitted');
      await reload();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmittingVote(false);
    }
  };

  const handleSubmitDecision = async () => {
    setSubmittingVote(true);
    try {
      await suggestionsApi.submitDecision(id, { decision: voteDecision, note: voteNote || undefined });
      showSuccess('Decision recorded');
      await reload();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to record decision');
    } finally {
      setSubmittingVote(false);
    }
  };

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!suggestion) return null;

  const availableTransitions = suggestion.availableTransitions || [];
  const isTerminal = TERMINAL_STATUSES.includes(suggestion.status);
  const canActOnCurrentStage = availableTransitions.length > 0;
  // technical_review is a parallel panel (team_lead/manager/ceo vote independently), not a single
  // claimed stage — the Move Workflow box below doesn't apply there; the Review Panel section
  // replaces it. Mirrors IdeaDetailPage's isPanelStage handling of under_review.
  const isPanelStage = suggestion.status === 'technical_review';

  // Who moved this suggestion into each step, and when — "submitted" comes from the suggestion
  // record itself (the submitter never goes through a logged transition into that first step),
  // every later step comes from the matching status-history entry.
  const stepInfo = { submitted: { date: suggestion.createdAt, username: suggestion.submitter?.name } };
  (history || []).forEach((h) => {
    stepInfo[h.toStatus] = { date: h.createdAt, username: h.changedByUser?.name };
  });
  // "Decided <date>" in the frozen-thread banner must be the actual terminal-transition timestamp,
  // not suggestion.updatedAt (bumped by unrelated later updates) — mirrors IdeaDetailPage's
  // ceoDecidedAt. Looked up by current status rather than a fixed role, since rejected/closed can
  // each be reached from different stages.
  const decidedAt = isTerminal ? stepInfo[suggestion.status]?.date || null : null;

  const renderWorkflowExtra = (step) => {
    const info = stepInfo[step];

    if (step === 'assigned') {
      if (suggestion.assignee?.name) {
        return (
          <>
            <Typography variant="caption" sx={{ display: 'block' }}>{suggestion.assignee.name}</Typography>
            {info && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {dayjs(info.date).format('MMM D, YYYY')}{info.username ? ` · ${info.username}` : ''}
              </Typography>
            )}
          </>
        );
      }
      if (canActOnCurrentStage && availableTransitions.includes('assigned')) {
        return (
          <TextField
            select fullWidth size="small" value={assignee} placeholder="Assign to"
            onChange={(e) => setAssignee(e.target.value)}
            sx={{ mt: 0.5 }}
          >
            <MenuItem value="">Select…</MenuItem>
            {users.map((u) => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
          </TextField>
        );
      }
      return undefined;
    }

    if (!info) return undefined;
    return (
      <Typography variant="caption" sx={{ display: 'block' }}>
        {dayjs(info.date).format('MMM D, YYYY')}{info.username ? ` · ${info.username}` : ''}
      </Typography>
    );
  };

  return (
    <Box>
      <BackButton />
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{suggestion.title}</Typography>
          {suggestion.description && (
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720, mt: 0.5, whiteSpace: 'pre-wrap', textAlign: 'justify' }}>
              {suggestion.description}
            </Typography>
          )}
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            {suggestion.application?.name && <Chip size="small" variant="outlined" label={suggestion.application.name} />}
            {suggestion.department?.name && <Chip size="small" variant="outlined" label={suggestion.department.name} />}
            {suggestion.functionalArea && <Chip size="small" variant="outlined" label={humanize(suggestion.functionalArea)} />}
            <StatusBadge value={suggestion.priority} />
            {suggestion.module && <Chip size="small" variant="outlined" label={suggestion.module} />}
          </Stack>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="body2" color="text.secondary">
            Submitted by, <Typography component="span" variant="body2" fontWeight={700} color="text.primary">{suggestion.submitter?.name || '—'}</Typography>
          </Typography>
          <VoteButtons entityType="suggestion" entityId={id} showBookmark={false} />
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        {/* 60/40 split on md+ (Grid's 12-column steps don't divide evenly into 60/40, so the
            exact ratio is set via sx flexBasis/maxWidth rather than an md={n} prop) — stacks to
            full width on mobile via xs={12}. Mirrors IdeaDetailPage.jsx's layout. */}
        <Grid item xs={12} sx={{ flexBasis: { md: '60%' }, maxWidth: { md: '60%' } }}>
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Field label="Current Problem" value={suggestion.currentProblem} />
            <Field label="Suggested Solution" value={suggestion.suggestedSolution} />
            <Field label="Expected Benefit" value={suggestion.expectedBenefit} />
          </Paper>

          <ReviewPanel
            reviewPanel={suggestion.reviewPanel} status={suggestion.status} livePanelStatus="technical_review"
            panelComplete={suggestion.panelComplete} myReviewSlot={suggestion.myReviewSlot}
            voteDecision={voteDecision} onVoteDecisionChange={setVoteDecision}
            voteNote={voteNote} onVoteNoteChange={setVoteNote}
            submitting={submittingVote}
            onSubmitReview={handleSubmitReview} onSubmitDecision={handleSubmitDecision}
          />

          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <NotesThread entityType="suggestion_note" entityId={id} title="Discussion" />
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            {/* Same rich-mode opt-in bundle as IdeaDetailPage's Discussion thread (no length cap,
                newest-first with the composer pinned at top, attachments, role badges, collapsible
                composer, sort toggle) and the same decided-lock behaviour. Title stays "Comments"
                (the default) rather than "Discussion" — NotesThread above already owns that name
                for this page's internal suggestion_note thread, and reusing it here would put two
                sections titled "Discussion" on the same page. */}
            <CommentThread
              entityType="suggestion" entityId={id} maxLength={0} newestFirst composerAtTop allowAttachments
              showRoleBadges collapsibleComposer attachmentViewer sortToggle
              submitterId={suggestion.submittedBy} reviewChain={suggestion.reviewPanel}
              disabled={isTerminal} disabledAt={decidedAt}
              disabledReason="This suggestion has been decided — the discussion thread is now read-only."
            />
          </Paper>
        </Grid>

        <Grid item xs={12} sx={{ flexBasis: { md: '40%' }, maxWidth: { md: '40%' } }}>
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Workflow</Typography>
            <WorkflowStepper
              steps={SUGGESTION_WORKFLOW_STEPS} currentStatus={suggestion.status}
              orientation="vertical" renderStepExtra={renderWorkflowExtra}
            />
          </Paper>

          {!isTerminal && !isPanelStage && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Move Workflow</Typography>
              {transitionError && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setTransitionError(null)}>{transitionError}</Alert>}
              {canActOnCurrentStage ? (
                <>
                  <TextField
                    fullWidth size="small" multiline minRows={2} placeholder="Add a note (optional)"
                    value={note} onChange={(e) => setNote(e.target.value)} sx={{ mb: 1.5 }}
                  />
                  <Stack spacing={1}>
                    {availableTransitions.map((status) => (
                      <Button
                        key={status}
                        variant="contained"
                        disabled={submitting || (status === 'assigned' && !assignee)}
                        onClick={() => handleTransitionClick(status)}
                      >
                        Move to {humanize(status)}
                      </Button>
                    ))}
                  </Stack>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Awaiting {(suggestion.stageOwnerRoles || []).join(' or ')}
                </Typography>
              )}
            </Paper>
          )}
        </Grid>
      </Grid>

      <ConfirmDialog
        open={!!confirmStatus}
        title={`Move to ${humanize(confirmStatus || '')}?`}
        description="Closing marks this suggestion as fully resolved and ends its workflow. Make sure the implementation is actually complete first."
        confirmLabel="Move to Closed"
        onConfirm={() => runTransition(confirmStatus)}
        onClose={() => setConfirmStatus(null)}
      />
    </Box>
  );
}

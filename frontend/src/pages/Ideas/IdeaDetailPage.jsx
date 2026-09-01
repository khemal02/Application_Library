import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/EditOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { ideasApi } from '../../services/domains';
import useResource from '../../hooks/useResource';
import useBreadcrumbLabel from '../../hooks/useBreadcrumbLabel';
import useToast from '../../hooks/useToast';
import { useAppSelector } from '../../app/hooks';
import { LoadingBlock, ErrorBlock } from '../../components/common/AsyncState';
import CommentThread from '../../components/common/CommentThread';
import BackButton from '../../components/common/BackButton';
import IdeaPanelCard from './IdeaPanelCard';
import usePermission from '../../routes/usePermission';
import humanize from '../../utils/humanize';

export default function IdeaDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [editingDescription, setEditingDescription] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [savingDesc, setSavingDesc] = useState(false);
  const [editingTech, setEditingTech] = useState(false);
  const [techDraft, setTechDraft] = useState('');
  const [savingTech, setSavingTech] = useState(false);
  const [ownerId, setOwnerId] = useState('');
  const [ownerCandidates, setOwnerCandidates] = useState([]);
  // Deliberately unset, not defaulted to 'approve' — a viewer who has never responded must see
  // NO pre-selected decision (see IdeaPanelCard's Change 1); resetting to '' on every idea change
  // below stops a stale choice from one idea silently carrying over to the next.
  const [voteDecision, setVoteDecision] = useState('');
  const [voteNote, setVoteNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const canUpdateIdeas = usePermission('ideas', 'update');
  const user = useAppSelector((state) => state.auth.user);
  const { showSuccess, showError } = useToast();

  const { data: idea, loading, error, reload } = useResource(() => ideasApi.getById(id), [id]);
  const { data: history } = useResource(() => ideasApi.statusHistory(id), [id]);
  useBreadcrumbLabel(idea?.title);

  // Only an approver (or a CEO breaking a tie — they aren't a panel member at all) with no
  // Application yet ever needs this. Fetched eagerly for any approver (not just the one whose
  // vote would actually decide it) so there's no loading flicker the moment it IS needed —
  // IdeaPanelCard decides whether to actually show the picker. Gated so a plain reviewer or
  // non-participant never fires this fetch at all. "Modify Current Application" (feature
  // requests) has its own module now and never needs this — see FeatureRequestDetailPage.jsx.
  const needsOwnerPicker = (idea?.panel?.myRow?.kind === 'approver' || idea?.panel?.canTieBreak)
    && !idea?.applicationId;

  useEffect(() => {
    if (!needsOwnerPicker) return;
    ideasApi.eligibleOwners().then((res) => setOwnerCandidates(res.data)).catch((err) => {
      setOwnerCandidates([]);
      showError(err.response?.data?.message || 'Failed to load eligible application owners');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsOwnerPicker, id]);

  // Reset the whole vote form whenever the idea itself changes — React Router doesn't remount
  // this component just because :id changed, so without this a decision picked on one idea could
  // silently survive into the next idea's (empty) form.
  useEffect(() => {
    setVoteDecision('');
    setVoteNote('');
    setOwnerId('');
  }, [id]);

  // Pre-fill the vote form with whatever the viewer already recorded, rather than resetting to
  // blank on every reload — re-opening the form to amend should show your current answer, not
  // force you to remember it. Falls back to '' (unset), NOT 'approve' — myRow.decision is only
  // null before a first response, and that must render as genuinely no selection (Change 1).
  useEffect(() => {
    if (!idea?.panel?.myRow) return;
    setVoteDecision(idea.panel.myRow.decision || '');
    setVoteNote(idea.panel.myRow.note || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idea?.panel?.myRow?.decision, idea?.panel?.myRow?.note]);

  // Returns whether the submission actually succeeded — IdeaPanelCard needs this to know whether
  // it's safe to collapse back to the read-only "your recorded response" view (Change 8): doing
  // that unconditionally would also collapse it on a FAILED submit, hiding the form (and whatever
  // the user was mid-typing) behind stale data that doesn't reflect what they just tried to do.
  const handleSubmitReview = async () => {
    setSubmitting(true);
    try {
      await ideasApi.submitReview(id, {
        decision: voteDecision,
        note: voteNote || undefined,
        ...(ownerId ? { ownerId } : {}),
      });
      showSuccess('Review submitted');
      setOwnerId('');
      await reload();
      return true;
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to submit review');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const startEditDescription = () => {
    setDescDraft(idea.description || '');
    setEditingDescription(true);
  };

  const saveDescription = async () => {
    setSavingDesc(true);
    try {
      await ideasApi.update(id, { description: descDraft });
      setEditingDescription(false);
      showSuccess('Description updated');
      await reload();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to update description');
    } finally {
      setSavingDesc(false);
    }
  };

  const startEditTech = () => {
    setTechDraft(idea.technologiesAndEfficiency || '');
    setEditingTech(true);
  };

  const saveTech = async () => {
    setSavingTech(true);
    try {
      await ideasApi.update(id, { technologiesAndEfficiency: techDraft });
      setEditingTech(false);
      showSuccess('Technologies and Efficiency updated');
      await reload();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to update Technologies and Efficiency');
    } finally {
      setSavingTech(false);
    }
  };

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!idea) return null;

  // Editing the description or the technologies/efficiency notes is blocked once the idea is
  // decided — same reasoning as the comment freeze: reviewers approved a specific record, and
  // (on approve) an Application was registered from it, so rewriting either afterwards would
  // make that record false. Enforced again in ideas.service.js#update — this check is a
  // convenience, not the actual rule. Shared by both fields since the rule is identical.
  const isDecided = idea.status === 'approved' || idea.status === 'rejected';
  // The submitter can't just tinker with a cleanly-progressing idea — edit only opens up once
  // someone on the panel (reviewer or approver) has actually flagged a problem with it
  // ("Partially supported" / "Don't Supported"). No such vote yet (or everyone's "Fully
  // supported" so far) means nothing to fix, so no edit access.
  const hasRequestedChangesOrReject = [...(idea.panel?.reviewers || []), ...(idea.panel?.approvers || [])]
    .some((entry) => entry.decision === 'request_changes' || entry.decision === 'reject');
  const canEditIdeaFields = canUpdateIdeas && idea.submittedBy === user?.id && !isDecided && hasRequestedChangesOrReject;
  // "Decided <date>" in the frozen-thread banner must be the actual terminal-transition
  // timestamp, not idea.updatedAt — the latter is bumped by any later update (e.g. a still-open
  // description edit) and would silently misreport the decision date. Looked up by current status
  // rather than a fixed role, since a panel can have several approvers and there's no single
  // "the" decider anymore — mirrors SuggestionDetailPage's identical decidedAt lookup.
  const decidedAt = isDecided ? (history || []).find((h) => h.toStatus === idea.status)?.createdAt || null : null;

  // CommentThread's showRoleBadges takes a generic `reviewChain`-shaped array (also fed by
  // Suggestions, as `reviewPanel` — see CommentThread.jsx's own docstring). Adapting the new
  // panel shape into it here, at this call site, rather than touching the shared component's
  // prop contract. `roleName` deliberately becomes 'reviewer'/'approver', not an actual role —
  // CommentThread's ROLE_PALETTE_KEY only special-cases 'team_lead'/'manager'/'ceo', so this
  // intentionally falls through to its plain-outlined-badge path (still labeled correctly via
  // reviewerLabel/roleLabel) rather than being forced into a misleading color.
  const panelReviewChain = [...(idea.panel?.reviewers || []), ...(idea.panel?.approvers || [])].map((entry) => ({
    roleName: entry.kind,
    reviewer: { id: entry.userId },
    reviewerLabel: entry.kind === 'approver' ? 'Approver' : 'Reviewer',
    roleLabel: entry.role,
  }));

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" alignItems="center" spacing={1}>
          <BackButton />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Submitted by, <Typography component="span" variant="body2" fontWeight={700} color="text.primary">{idea.submitter?.name || '—'}</Typography>
        </Typography>
      </Stack>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>{idea.title}</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
          {idea.applicationId && idea.application?.name && (
            <Chip
              size="small" color="success" variant="outlined" clickable
              label={`Registered as: ${idea.application.name}`}
              onClick={() => navigate(`/applications/${idea.applicationId}`)}
            />
          )}
          {idea.changeRequest && (
            <Chip
              size="small" color="success" variant="outlined" clickable
              label="Change request created"
              onClick={() => navigate(`/applications/${idea.changeRequest.applicationId}/change-requests/${idea.changeRequest.id}`)}
            />
          )}
          {idea.department?.name && (
            <Chip size="small" variant="outlined" label={idea.department.name} />
          )}
          {idea.industry && <Chip size="small" variant="outlined" label={humanize(idea.industry)} />}
          {idea.functionalArea && <Chip size="small" variant="outlined" label={humanize(idea.functionalArea)} />}
          {idea.internalUse && <Chip size="small" color="info" label="Internal Use" />}
        </Stack>
      </Box>

      <Grid container spacing={2}>
        {/* 60/40 split on md+ (Grid's 12-column steps don't divide evenly into 60/40, so the
            exact ratio is set via sx flexBasis/maxWidth rather than an md={n} prop) — stacks to
            full width on mobile via xs={12}. */}
        <Grid item xs={12} sx={{ flexBasis: { md: '60%' }, maxWidth: { md: '60%' } }}>
          {editingDescription ? (
            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth multiline minRows={3} autoFocus
                value={descDraft} onChange={(e) => setDescDraft(e.target.value)}
                sx={{ '& .MuiInputBase-input': { textAlign: 'justify' } }}
              />
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <IconButton size="small" color="primary" aria-label="Save description" disabled={savingDesc} onClick={saveDescription}>
                  <CheckIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" aria-label="Cancel editing description" disabled={savingDesc} onClick={() => setEditingDescription(false)}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Box>
          ) : (
            (idea.description || canEditIdeaFields) && (
              <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 3 }}>
                <Typography variant="body1" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', textAlign: 'justify', flexGrow: 1 }}>
                  {idea.description || '—'}
                </Typography>
                {canEditIdeaFields && (
                  <IconButton size="small" aria-label="Edit description" onClick={startEditDescription}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                )}
              </Stack>
            )
          )}

          {(idea.technologiesAndEfficiency || canEditIdeaFields) && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>Technologies and Efficiency</Typography>
              {editingTech ? (
                <Box>
                  <TextField
                    fullWidth multiline minRows={3} autoFocus
                    value={techDraft} onChange={(e) => setTechDraft(e.target.value)}
                    sx={{ '& .MuiInputBase-input': { textAlign: 'justify' } }}
                  />
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <IconButton size="small" color="primary" aria-label="Save Technologies and Efficiency" disabled={savingTech} onClick={saveTech}>
                      <CheckIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" aria-label="Cancel editing Technologies and Efficiency" disabled={savingTech} onClick={() => setEditingTech(false)}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Box>
              ) : (
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Typography variant="body1" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', textAlign: 'justify', flexGrow: 1 }}>
                    {idea.technologiesAndEfficiency || '—'}
                  </Typography>
                  {canEditIdeaFields && (
                    <IconButton size="small" aria-label="Edit Technologies and Efficiency" onClick={startEditTech}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              )}
            </Box>
          )}
        </Grid>

        <Grid item xs={12} sx={{ flexBasis: { md: '40%' }, maxWidth: { md: '40%' } }}>
          <IdeaPanelCard
            idea={idea} panel={idea.panel}
            voteDecision={voteDecision} onVoteDecisionChange={setVoteDecision}
            voteNote={voteNote} onVoteNoteChange={setVoteNote}
            ownerId={ownerId} onOwnerIdChange={setOwnerId} ownerCandidates={ownerCandidates}
            submitting={submitting} onSubmitReview={handleSubmitReview}
            onPanelChanged={reload}
          />

          <Paper variant="outlined" sx={{ p: 2 }}>
            <CommentThread
              entityType="idea" entityId={id} title="Discussion" maxLength={0} newestFirst composerAtTop allowAttachments
              showRoleBadges collapsibleComposer attachmentViewer sortToggle
              submitterId={idea.submittedBy} reviewChain={panelReviewChain}
              disabled={isDecided} disabledAt={decidedAt}
              disabledReason="This idea has been decided — the discussion thread is now read-only."
            />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

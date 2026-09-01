import { useState, useEffect } from 'react';
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
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { featureRequestsApi } from '../../services/domains';
import useResource from '../../hooks/useResource';
import useBreadcrumbLabel from '../../hooks/useBreadcrumbLabel';
import useToast from '../../hooks/useToast';
import { useAppSelector } from '../../app/hooks';
import { LoadingBlock, ErrorBlock } from '../../components/common/AsyncState';
import CommentThread from '../../components/common/CommentThread';
import BackButton from '../../components/common/BackButton';
import FeatureRequestPanelCard from './FeatureRequestPanelCard';
import usePermission from '../../routes/usePermission';
import humanize from '../../utils/humanize';

/**
 * Forked from IdeaDetailPage.jsx — see the Ideas/Feature-Requests split. A feature request always
 * already targets an existing Application, so this drops: the owner-picker/eligibleOwners fetch
 * (approving here never registers a new Application), the "Registered as" chip (there's nothing
 * to register), and the Technologies and Efficiency section (never collected on this form).
 */
export default function FeatureRequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [editingDescription, setEditingDescription] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [savingDesc, setSavingDesc] = useState(false);
  // Deliberately unset, not defaulted to 'approve' — a viewer who has never responded must see
  // NO pre-selected decision; resetting to '' on every feature request change below stops a stale
  // choice from one request silently carrying over to the next.
  const [voteDecision, setVoteDecision] = useState('');
  const [voteNote, setVoteNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const canUpdateFeatureRequests = usePermission('feature_requests', 'update');
  const user = useAppSelector((state) => state.auth.user);
  const { showSuccess, showError } = useToast();

  const { data: featureRequest, loading, error, reload } = useResource(() => featureRequestsApi.getById(id), [id]);
  const { data: history } = useResource(() => featureRequestsApi.statusHistory(id), [id]);
  useBreadcrumbLabel(featureRequest?.title);

  // Reset the whole vote form whenever the request itself changes — React Router doesn't remount
  // this component just because :id changed, so without this a decision picked on one request
  // could silently survive into the next request's (empty) form.
  useEffect(() => {
    setVoteDecision('');
    setVoteNote('');
  }, [id]);

  // Pre-fill the vote form with whatever the viewer already recorded, rather than resetting to
  // blank on every reload — re-opening the form to amend should show your current answer, not
  // force you to remember it. Falls back to '' (unset), NOT 'approve' — myRow.decision is only
  // null before a first response, and that must render as genuinely no selection.
  useEffect(() => {
    if (!featureRequest?.panel?.myRow) return;
    setVoteDecision(featureRequest.panel.myRow.decision || '');
    setVoteNote(featureRequest.panel.myRow.note || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featureRequest?.panel?.myRow?.decision, featureRequest?.panel?.myRow?.note]);

  // Returns whether the submission actually succeeded — FeatureRequestPanelCard needs this to
  // know whether it's safe to collapse back to the read-only "your recorded response" view: doing
  // that unconditionally would also collapse it on a FAILED submit, hiding the form (and whatever
  // the user was mid-typing) behind stale data that doesn't reflect what they just tried to do.
  const handleSubmitReview = async () => {
    setSubmitting(true);
    try {
      await featureRequestsApi.submitReview(id, {
        decision: voteDecision,
        note: voteNote || undefined,
      });
      showSuccess('Review submitted');
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
    setDescDraft(featureRequest.description || '');
    setEditingDescription(true);
  };

  const saveDescription = async () => {
    setSavingDesc(true);
    try {
      await featureRequestsApi.update(id, { description: descDraft });
      setEditingDescription(false);
      showSuccess('Description updated');
      await reload();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to update description');
    } finally {
      setSavingDesc(false);
    }
  };

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!featureRequest) return null;

  // Editing the description is blocked once the request is decided — same reasoning as the
  // comment freeze: reviewers approved a specific record, so rewriting it afterwards would make
  // that record false. Enforced again in featureRequests.service.js#update — this check is a
  // convenience, not the actual rule.
  const isDecided = featureRequest.status === 'approved' || featureRequest.status === 'rejected';
  const canEditFields = canUpdateFeatureRequests && featureRequest.submittedBy === user?.id && !isDecided;
  // "Decided <date>" in the frozen-thread banner must be the actual terminal-transition
  // timestamp, not featureRequest.updatedAt — the latter is bumped by any later update (e.g. a
  // still-open description edit) and would silently misreport the decision date. Looked up by
  // current status rather than a fixed role, since a panel can have several approvers and there's
  // no single "the" decider anymore.
  const decidedAt = isDecided ? (history || []).find((h) => h.toStatus === featureRequest.status)?.createdAt || null : null;

  // CommentThread's showRoleBadges takes a generic `reviewChain`-shaped array. Adapting the panel
  // shape into it here, at this call site, rather than touching the shared component's prop
  // contract. `roleName` deliberately becomes 'reviewer'/'approver', not an actual role —
  // CommentThread's ROLE_PALETTE_KEY only special-cases 'team_lead'/'manager'/'ceo', so this
  // intentionally falls through to its plain-outlined-badge path (still labeled correctly via
  // reviewerLabel/roleLabel) rather than being forced into a misleading color.
  const panelReviewChain = [...(featureRequest.panel?.reviewers || []), ...(featureRequest.panel?.approvers || [])].map((entry) => ({
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
          {featureRequest.application?.name && (
            <Stack direction="row" spacing={0.25} alignItems="center">
              <Typography variant="h0" fontWeight={700}>{featureRequest.application.name}</Typography>
              <IconButton
                size="small" aria-label={`Open ${featureRequest.application.name}`}
                onClick={() => navigate(`/applications/${featureRequest.applicationId}`)}
              >
                <OpenInNewIcon fontSize="inherit" />
              </IconButton>
            </Stack>
          )}
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Submitted by, <Typography component="span" variant="body2" fontWeight={700} color="text.primary">{featureRequest.submitter?.name || '—'}</Typography>
        </Typography>
      </Stack>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>{featureRequest.title}</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
          {featureRequest.changeRequest && (
            <Chip
              size="small" color="success" variant="outlined" clickable
              label="Change request created"
              onClick={() => navigate(`/applications/${featureRequest.changeRequest.applicationId}/change-requests/${featureRequest.changeRequest.id}`)}
            />
          )}
          {featureRequest.department?.name && (
            <Chip size="small" variant="outlined" label={featureRequest.department.name} />
          )}
          {featureRequest.industry && <Chip size="small" variant="outlined" label={humanize(featureRequest.industry)} />}
          {featureRequest.functionalArea && <Chip size="small" variant="outlined" label={humanize(featureRequest.functionalArea)} />}
          {featureRequest.internalUse && <Chip size="small" color="info" label="Internal Use" />}
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
            (featureRequest.description || canEditFields) && (
              <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 3 }}>
                <Typography variant="body1" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', textAlign: 'justify', flexGrow: 1 }}>
                  {featureRequest.description || '—'}
                </Typography>
                {canEditFields && (
                  <IconButton size="small" aria-label="Edit description" onClick={startEditDescription}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                )}
              </Stack>
            )
          )}
        </Grid>

        <Grid item xs={12} sx={{ flexBasis: { md: '40%' }, maxWidth: { md: '40%' } }}>
          <FeatureRequestPanelCard
            featureRequest={featureRequest} panel={featureRequest.panel}
            voteDecision={voteDecision} onVoteDecisionChange={setVoteDecision}
            voteNote={voteNote} onVoteNoteChange={setVoteNote}
            submitting={submitting} onSubmitReview={handleSubmitReview}
            onPanelChanged={reload}
          />

          <Paper variant="outlined" sx={{ p: 2 }}>
            <CommentThread
              entityType="feature_request" entityId={id} title="Discussion" maxLength={0} newestFirst composerAtTop allowAttachments
              showRoleBadges collapsibleComposer attachmentViewer sortToggle
              submitterId={featureRequest.submittedBy} reviewChain={panelReviewChain}
              disabled={isDecided} disabledAt={decidedAt}
              disabledReason="This feature request has been decided — the discussion thread is now read-only."
            />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

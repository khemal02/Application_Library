import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import dayjs from 'dayjs';

const PANEL_DECISION_LABELS = { approve: 'Approve', reject: 'Reject' };
const PANEL_DECISION_COLORS = { approve: 'success', reject: 'error' };

/**
 * The parallel review-panel block — shared by Ideas (under_review) and Suggestions
 * (technical_review), same shape returned by both APIs' getById (reviewPanel/panelComplete/
 * myReviewSlot, functional-area matched — see backend/src/utils/reviewPanel.js).
 * `status`/`livePanelStatus` decide whether the panel is currently open for voting (e.g. idea's
 * status === 'under_review') vs showing a historical, read-only record of past verdicts.
 * team_lead/manager vote independently; ceo is hard-gated on both of them being done — no override
 * — so the ceo's own vote form is replaced with a waiting message until panelComplete.
 */
export default function ReviewPanel({
  reviewPanel, status, livePanelStatus, panelComplete, myReviewSlot,
  voteDecision, onVoteDecisionChange, voteNote, onVoteNoteChange,
  submitting,
  onSubmitReview, onSubmitDecision,
}) {
  if (!reviewPanel) return null;
  const isLive = status === livePanelStatus;

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle2" fontWeight={700}>Review Panel</Typography>
        {isLive && (
          <Chip
            size="small"
            color={panelComplete ? 'success' : 'default'}
            label={panelComplete ? 'Panel complete' : 'Awaiting votes'}
          />
        )}
      </Stack>
      <Stack spacing={1.5} divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
        {reviewPanel.map((slot) => (
          <Stack key={slot.roleName} direction="row" spacing={2} alignItems="flex-start">
            <Box sx={{ minWidth: 96 }}>
              <Typography variant="body2" fontWeight={600}>{slot.roleLabel}</Typography>
              {slot.usedFallback && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  No {slot.roleLabel.toLowerCase()} for this functional area — org-wide
                </Typography>
              )}
            </Box>
            <Box sx={{ flexGrow: 1 }}>
              {slot.decision ? (
                <>
                  <Chip size="small" color={PANEL_DECISION_COLORS[slot.decision]} label={PANEL_DECISION_LABELS[slot.decision]} />
                  {slot.note && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>{slot.note}</Typography>
                  )}
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    {slot.reviewer?.name}{slot.reviewedAt ? ` · ${dayjs(slot.reviewedAt).format('MMM D, YYYY')}` : ''}
                  </Typography>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">Vacant</Typography>
              )}
            </Box>
          </Stack>
        ))}
      </Stack>

      {myReviewSlot && (
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          {!myReviewSlot.eligible ? (
            <Alert severity="info">You are not eligible to review this — it belongs to a different functional area.</Alert>
          ) : myReviewSlot.roleName === 'ceo' && !panelComplete ? (
            <Alert severity="info">
              Waiting on {reviewPanel.filter((s) => ['team_lead', 'manager'].includes(s.roleName) && !s.decision).map((s) => s.roleLabel).join(' and ')} before you can finalize this suggestion.
            </Alert>
          ) : (
            <Stack spacing={1.5}>
              <Typography variant="body2" fontWeight={600}>
                {myReviewSlot.roleName === 'ceo' ? 'Your decision' : 'Your review'}
              </Typography>
              <TextField
                select fullWidth size="small" label="Decision"
                value={voteDecision} onChange={(e) => onVoteDecisionChange(e.target.value)}
              >
                <MenuItem value="approve">Approve</MenuItem>
                <MenuItem value="reject">Reject</MenuItem>
              </TextField>
              <TextField
                fullWidth size="small" multiline minRows={2} placeholder="Add a note (optional)"
                value={voteNote} onChange={(e) => onVoteNoteChange(e.target.value)}
              />
              <Box>
                <Button
                  variant="contained" disabled={submitting}
                  onClick={myReviewSlot.roleName === 'ceo' ? onSubmitDecision : onSubmitReview}
                >
                  {myReviewSlot.roleName === 'ceo'
                    ? 'Finalize Decision'
                    : (myReviewSlot.decision ? 'Update Review' : 'Submit Review')}
                </Button>
              </Box>
            </Stack>
          )}
        </Box>
      )}
    </Paper>
  );
}

import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import useToast from '../../hooks/useToast';
import { ideasApi, featureRequestsApi } from '../../services/domains';

// Bounds the Start Date picker below — a track shouldn't be planned to start in the past.
const today = new Date().toISOString().slice(0, 10);

/**
 * Starts Development on an approved idea/feature request — see ideas.service.js#moveToBuild /
 * featureRequests.service.js#moveToBuild. Development starts unassigned; who's actually doing
 * that work is picked afterward from Application Tracking's own per-stage Assignee control, not
 * here — this dialog no longer asks for one.
 *
 * An idea's track is born with no owner any more (approving no longer picks one — see
 * ideas.service.js#finalizeIdea) — so for an idea row whose track has no owner yet, this dialog
 * asks for the Application Owner (+ an optional Start Date), same fields that used to live on the
 * approve form, same eligible-owner candidate list (ideasApi.eligibleOwners). A feature request
 * never needs this — its Application already has a permanent owner — and neither does an idea
 * whose track already has one (legacy data).
 *
 * Shared, not duplicated, between the Ideas/Feature Requests list's Build column and Application
 * Tracking's own "Move to Build" button (ApplicationTrackingListPage.jsx) — the latter passes a
 * synthetic `row` shaped the same way (`{ _type: 'idea', id: <ideaId>, title, track: { id,
 * ownerId } }`) since its own list only ever shows idea-originated tracks.
 *
 * `row` shape: `{ _type: 'idea' | 'feature_request', id, title, track?: { id, ownerId } }`.
 */
export default function MoveToBuildDialog({
  row, onClose, onMoved,
}) {
  const { showSuccess, showError } = useToast();
  const [ownerCandidates, setOwnerCandidates] = useState([]);
  const [ownerId, setOwnerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const needsOwner = row?._type === 'idea' && !row?.track?.ownerId;

  useEffect(() => {
    if (!row) return;
    setOwnerId('');
    setStartDate('');
    if (row._type === 'idea' && !row.track?.ownerId) {
      ideasApi.eligibleOwners().then((res) => setOwnerCandidates(res.data)).catch(() => setOwnerCandidates([]));
    }
  }, [row]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      if (row._type === 'idea') {
        await ideasApi.moveToBuild(row.id, {
          ...(needsOwner ? { ownerId, ...(startDate ? { startDate } : {}) } : {}),
        });
      } else {
        await featureRequestsApi.moveToBuild(row.id, {});
      }
      showSuccess('Moved to build — Development is now in progress');
      onMoved();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to move this to build');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!row} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Move &ldquo;{row?.title}&rdquo; to build</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {needsOwner ? (
            <>
              <TextField
                select fullWidth size="small" label="Application Owner"
                value={ownerId} onChange={(e) => setOwnerId(e.target.value)}
                disabled={submitting}
                helperText="Required — this idea's track has no owner yet."
              >
                <MenuItem value="">Select…</MenuItem>
                {ownerCandidates.map((u) => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
              </TextField>
              <TextField
                fullWidth size="small" type="date" label="Start Date"
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: today }}
                value={startDate} onChange={(e) => setStartDate(e.target.value)}
                disabled={submitting}
              />
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Development will start, unassigned — assign who&rsquo;s doing it from Application Tracking afterward.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="contained" disabled={submitting || (needsOwner && !ownerId)} onClick={handleConfirm}>
          Move to Build
        </Button>
      </DialogActions>
    </Dialog>
  );
}

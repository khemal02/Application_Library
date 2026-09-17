import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import useToast from '../../hooks/useToast';
import {
  ideasApi, featureRequestsApi, applicationTrackingApi, changeRequestsApi,
} from '../../services/domains';

/**
 * Picks who's actually building an approved idea/feature request and starts Development in one
 * call — see ideas.service.js#moveToBuild / featureRequests.service.js#moveToBuild. Assignee
 * candidates are fetched fresh each time the dialog opens for a given row, from whichever module's
 * own (identical, "any active user") assignee-candidates endpoint that row's type already has.
 *
 * An idea's track is born with no owner any more (approving no longer picks one — see
 * ideas.service.js#finalizeIdea) — so for an idea row whose track has no owner yet, this dialog
 * ALSO asks for the Application Owner (+ optional Start/Expected Deployment dates), same fields
 * that used to live on the approve form, same eligible-owner candidate list
 * (ideasApi.eligibleOwners). A feature request never needs this — its Application already has a
 * permanent owner — and neither does an idea whose track already has one (legacy data).
 *
 * Shared, not duplicated, between the Ideas/Feature Requests list's Build column and Application
 * Tracking's own "Move to Build" button (ApplicationTrackingListPage.jsx) — the latter passes a
 * synthetic `row` shaped the same way (`{ _type: 'idea', id: <ideaId>, title, track: { id,
 * ownerId } }`) since its own list only ever shows idea-originated tracks.
 *
 * `row` shape: `{ _type: 'idea' | 'feature_request', id, title, track?: { id, ownerId },
 * changeRequest?: { id }, application?: { id } }`.
 */
export default function MoveToBuildDialog({
  row, onClose, onMoved,
}) {
  const { showSuccess, showError } = useToast();
  const [candidates, setCandidates] = useState([]);
  const [assigneeId, setAssigneeId] = useState('');
  const [ownerCandidates, setOwnerCandidates] = useState([]);
  const [ownerId, setOwnerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [targetGoLive, setTargetGoLive] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const needsOwner = row?._type === 'idea' && !row?.track?.ownerId;

  useEffect(() => {
    if (!row) return;
    setAssigneeId('');
    setOwnerId('');
    setStartDate('');
    setTargetGoLive('');
    const fetchCandidates = row._type === 'idea'
      ? applicationTrackingApi.assigneeCandidates(row.track.id)
      : changeRequestsApi.assigneeCandidates(row.application.id, row.changeRequest.id);
    fetchCandidates.then((res) => setCandidates(res.data)).catch(() => setCandidates([]));
    if (row._type === 'idea' && !row.track?.ownerId) {
      ideasApi.eligibleOwners().then((res) => setOwnerCandidates(res.data)).catch(() => setOwnerCandidates([]));
    }
  }, [row]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      if (row._type === 'idea') {
        await ideasApi.moveToBuild(row.id, {
          assigneeId,
          ...(needsOwner ? { ownerId, ...(startDate ? { startDate } : {}), ...(targetGoLive ? { targetGoLive } : {}) } : {}),
        });
      } else {
        await featureRequestsApi.moveToBuild(row.id, { assigneeId });
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
          {needsOwner && (
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
              <Stack direction="row" spacing={1.5}>
                <TextField
                  fullWidth size="small" type="date" label="Start Date"
                  InputLabelProps={{ shrink: true }}
                  value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  disabled={submitting}
                />
                <TextField
                  fullWidth size="small" type="date" label="Expected Deployment Date"
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ min: startDate || undefined }}
                  value={targetGoLive} onChange={(e) => setTargetGoLive(e.target.value)}
                  disabled={submitting}
                />
              </Stack>
            </>
          )}
          <TextField
            select fullWidth size="small" label="Who's building this?"
            value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}
            disabled={submitting}
          >
            {candidates.map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.name}{c.roleLabel ? ` — ${c.roleLabel}` : ''}</MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="contained" disabled={submitting || !assigneeId || (needsOwner && !ownerId)} onClick={handleConfirm}>
          Move to Build
        </Button>
      </DialogActions>
    </Dialog>
  );
}

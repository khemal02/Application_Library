import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Checkbox from '@mui/material/Checkbox';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import { featureRequestsApi } from '../../services/domains';
import useToast from '../../hooks/useToast';
import humanize from '../../utils/humanize';

/**
 * Forked from PanelPickerDialog.jsx — see the Ideas/Feature-Requests split. The "+ Add" picker for
 * a feature request's review panel. GET /feature-requests/:id/panel-candidates already excludes
 * the submitter and everyone already on the panel server-side — featureRequests.service.js
 * #panelCandidates — so there's nothing to show-but-disable here; the list returned IS exactly
 * who's left to add.
 */
export default function FeatureRequestPanelPickerDialog({ open, kind, featureRequestId, onClose, onAdded }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const { showSuccess } = useToast();

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setSelected([]);
    setError(null);
    setLoading(true);
    featureRequestsApi.panelCandidates(featureRequestId, kind)
      .then((res) => setCandidates(res.data))
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false));
  }, [open, featureRequestId, kind]);

  const filtered = candidates.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  const toggle = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await featureRequestsApi.addParticipants(featureRequestId, { kind, userIds: selected });
      showSuccess(kind === 'approver' ? 'Approvers added' : 'Reviewers added');
      onAdded();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add to panel');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{kind === 'approver' ? 'Add Approvers' : 'Add Reviewers'}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>{error}</Alert>}
        <TextField
          fullWidth size="small" placeholder="Search by name…"
          value={search} onChange={(e) => setSearch(e.target.value)} sx={{ mb: 1 }}
        />
        {loading ? (
          <Typography variant="body2" color="text.secondary">Loading…</Typography>
        ) : filtered.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {candidates.length === 0 ? 'Nobody is eligible to add.' : 'No match.'}
          </Typography>
        ) : (
          <List dense sx={{ maxHeight: 320, overflowY: 'auto' }}>
            {filtered.map((c) => (
              <ListItem key={c.id} disablePadding>
                <ListItemButton onClick={() => toggle(c.id)} dense>
                  <Checkbox edge="start" checked={selected.includes(c.id)} tabIndex={-1} disableRipple />
                  <ListItemText
                    primary={c.name}
                    secondary={(
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.25 }}>
                        <Chip size="small" variant="outlined" label={c.role} />
                        {(c.functionalAreas || []).map((fa) => <Chip key={fa} size="small" variant="outlined" label={humanize(fa)} />)}
                      </Stack>
                    )}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={submitting || selected.length === 0} onClick={submit}>
          Add{selected.length > 0 ? ` (${selected.length})` : ''}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

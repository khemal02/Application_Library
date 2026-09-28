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
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import { ideasApi } from '../../services/domains';
import useToast from '../../hooks/useToast';

/**
 * The "+ Add" picker for an idea's review panel. GET /ideas/:id/panel-candidates already excludes
 * the submitter (R3) and everyone already on the panel (one row per person per idea) server-side
 * — ideas.service.js#panelCandidates — so there's nothing to show-but-disable here the way a
 * generic user picker might; the list returned IS exactly who's left to add.
 */
export default function PanelPickerDialog({ open, kind, ideaId, onClose, onAdded }) {
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
    ideasApi.panelCandidates(ideaId, kind)
      .then((res) => setCandidates(res.data))
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false));
  }, [open, ideaId, kind]);

  const filtered = candidates.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  const toggle = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await ideasApi.addParticipants(ideaId, { kind, userIds: selected });
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
      <DialogTitle sx={{ fontWeight: 700, fontSize: '20px' }}>{kind === 'approver' ? 'Add Approvers' : 'Add Reviewers'}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>{error}</Alert>}
        <TextField
          fullWidth placeholder="Search by name…"
          value={search} onChange={(e) => setSearch(e.target.value)} sx={{ mb: 1.5 }}
        />
        {loading ? (
          <Typography variant="body2" color="text.secondary">Loading…</Typography>
        ) : filtered.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {candidates.length === 0 ? 'Nobody is eligible to add.' : 'No match.'}
          </Typography>
        ) : (
          <List disablePadding sx={{ maxHeight: 340, overflowY: 'auto' }}>
            {filtered.map((c, idx) => (
              <ListItem key={c.id} disablePadding divider={idx < filtered.length - 1}>
                <ListItemButton onClick={() => toggle(c.id)} sx={{ py: 1.5 }}>
                  <Checkbox edge="start" checked={selected.includes(c.id)} tabIndex={-1} disableRipple />
                  <ListItemText
                    primary={c.name}
                    primaryTypographyProps={{ fontWeight: 700 }}
                    secondary={(
                      <Chip
                        size="small" label={c.role}
                        sx={{
                          mt: 0.5, bgcolor: '#F1F3F6', color: '#4B5563', border: 'none',
                          fontWeight: 600, fontSize: '11.5px',
                        }}
                      />
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

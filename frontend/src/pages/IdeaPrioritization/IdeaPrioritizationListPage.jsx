import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Link from '@mui/material/Link';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { ErrorBlock } from '../../components/common/AsyncState';
import StatusBadge from '../../components/common/StatusBadge';
import useToast from '../../hooks/useToast';
import usePermission from '../../routes/usePermission';
import { applicationTrackingApi } from '../../services/domains';
import useBreadcrumbLabel from '../../hooks/useBreadcrumbLabel';
import MoveToBuildDialog from '../Ideas/MoveToBuildDialog';
import { deriveStatusChip } from '../../utils/applicationTrackStatus';

// A track's own Development stage row — every track has exactly one. Eligible for the ranked
// queue the same way the backend does (applicationTracking.service.js#reorder/#moveToBuild):
// status 'active' AND Development still 'not_started'.
function developmentStage(track) {
  return track.stages?.find((s) => s.stage === 'development');
}
function isWaitingToStart(track) {
  return track.status === 'active' && developmentStage(track)?.status === 'not_started';
}

/**
 * Computes the two track ids that should end up immediately before/after a moved item, given its
 * OLD index and desired FINAL index in `list` (already sorted by rank ascending). Shared by both
 * the up/down arrow buttons (toIndex = fromIndex ∓ 1) and drag-and-drop (toIndex = the row the
 * item was dropped onto) — same math either way, just a different `toIndex`.
 */
function computeNeighbors(list, fromIndex, toIndex) {
  const reduced = list.filter((_, idx) => idx !== fromIndex);
  const insertAt = Math.max(0, Math.min(toIndex, reduced.length));
  const before = reduced[insertAt - 1] || null;
  const after = reduced[insertAt] || null;
  return { beforeTrackId: before?.id ?? null, afterTrackId: after?.id ?? null };
}

function OrderBadge({ children, muted }) {
  return (
    <Avatar
      sx={{
        width: 28, height: 28, fontSize: 13, fontWeight: 700,
        bgcolor: muted ? 'action.disabledBackground' : 'primary.main',
        color: muted ? 'text.disabled' : 'primary.contrastText',
      }}
    >
      {children}
    </Avatar>
  );
}

function ApplicationIdeaCell({ track }) {
  return (
    <Link component={RouterLink} to={`/application-tracking/${track.id}`} underline="hover" variant="body2" fontWeight={600}>
      {track.name}
    </Link>
  );
}

/**
 * Idea Prioritization — a dedicated module (distinct from Application Tracking, by explicit
 * request) for exactly one job: deciding what gets built next, and starting it. Two tables:
 * "Waiting to start" (active tracks whose Development stage hasn't begun, in manual build-
 * sequence order via `queue_rank` — see the reorder migration/service on
 * applicationTracking.service.js) is the reorderable, actionable one; everything else (already
 * in progress, on hold, live, cancelled) is shown below, read-only, for context — clearly labeled
 * "not reorderable — work is underway" rather than just silently missing.
 *
 * Reorder controls (drag handle + up/down arrows) and "Move to Build →" are missing entirely, not
 * disabled, for a viewer without `ideas:moveToBuild` — the same permission that already gates
 * Move to Build on the merged Ideas/Feature Requests list, reused here rather than a second grant.
 * That list's own Build column is untouched by this page.
 */
export default function IdeaPrioritizationListPage() {
  const { showError } = useToast();
  const canManageQueue = usePermission('ideas', 'moveToBuild');
  useBreadcrumbLabel('Idea Prioritization');

  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [buildTarget, setBuildTarget] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const loadTracks = () => {
    setLoading(true);
    setError(null);
    applicationTrackingApi.list({ limit: 100 })
      .then((res) => setTracks(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(loadTracks, [reloadToken]);

  const waiting = tracks.filter(isWaitingToStart).sort((a, b) => (a.queueRank ?? 0) - (b.queueRank ?? 0));
  const started = tracks.filter((t) => !isWaitingToStart(t));

  const handleReorder = async (trackId, neighbors) => {
    try {
      await applicationTrackingApi.reorder(trackId, neighbors);
      setReloadToken((t) => t + 1);
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to reorder');
    }
  };

  if (loading) return null;
  if (error) return <ErrorBlock message={error} onRetry={loadTracks} />;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>Idea Prioritization</Typography>

      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Order</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Application / Idea</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Submitted By</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
              {canManageQueue && <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {waiting.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManageQueue ? 6 : 5}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                    Nothing waiting to start — approved ideas appear here until they're moved to build.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {waiting.map((track, index) => (
              <TableRow
                key={track.id}
                draggable={canManageQueue}
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex === null || dragIndex === index) return;
                  handleReorder(waiting[dragIndex].id, computeNeighbors(waiting, dragIndex, index));
                  setDragIndex(null);
                }}
                sx={{ opacity: dragIndex === index ? 0.4 : 1, cursor: canManageQueue ? 'grab' : 'default' }}
              >
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    {canManageQueue && <DragIndicatorIcon fontSize="small" color="disabled" />}
                    <OrderBadge>{index + 1}</OrderBadge>
                  </Stack>
                </TableCell>
                <TableCell><ApplicationIdeaCell track={track} /></TableCell>
                <TableCell>
                  <Typography variant="body2" color={track.idea?.submitter?.name ? 'text.primary' : 'text.disabled'}>
                    {track.idea?.submitter?.name || '—'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color={track.idea?.department?.name ? 'text.primary' : 'text.disabled'}>
                    {track.idea?.department?.name || '—'}
                  </Typography>
                </TableCell>
                <TableCell><StatusBadge value={track.priority} /></TableCell>
                {canManageQueue && (
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                      <Tooltip title="Move up">
                        <span>
                          <IconButton
                            size="small" disabled={index === 0}
                            onClick={() => handleReorder(track.id, computeNeighbors(waiting, index, index - 1))}
                          >
                            <KeyboardArrowUpIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Move down">
                        <span>
                          <IconButton
                            size="small" disabled={index === waiting.length - 1}
                            onClick={() => handleReorder(track.id, computeNeighbors(waiting, index, index + 1))}
                          >
                            <KeyboardArrowDownIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Button size="small" variant="contained" color="info" onClick={() => setBuildTarget(track)}>
                        Move to Build →
                      </Button>
                    </Stack>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>
          Already started
        </Typography>
        <Chip size="small" variant="outlined" label="not reorderable — work is underway" />
      </Stack>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Order</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Application / Idea</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Submitted By</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Owner</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {started.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                    Nothing in progress yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {started.map((track) => {
              const isMuted = track.status === 'on_hold' || track.status === 'cancelled';
              return (
                <TableRow key={track.id} sx={{ opacity: isMuted ? 0.55 : 1 }}>
                  <TableCell><OrderBadge muted>—</OrderBadge></TableCell>
                  <TableCell><ApplicationIdeaCell track={track} /></TableCell>
                  <TableCell>
                    <Typography variant="body2" color={track.idea?.submitter?.name ? 'text.primary' : 'text.disabled'}>
                      {track.idea?.submitter?.name || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color={track.idea?.department?.name ? 'text.primary' : 'text.disabled'}>
                      {track.idea?.department?.name || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell><StatusBadge value={track.priority} /></TableCell>
                  <TableCell>
                    {(() => {
                      const chip = deriveStatusChip(track);
                      return <StatusBadge color={chip.color} label={chip.label} />;
                    })()}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color={track.owner?.name ? 'text.primary' : 'text.disabled'}>
                      {track.owner?.name || '—'}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {buildTarget && (
        <MoveToBuildDialog
          row={{
            _type: 'idea',
            id: buildTarget.ideaId,
            title: buildTarget.name,
            track: { id: buildTarget.id, ownerId: buildTarget.ownerId },
          }}
          onClose={() => setBuildTarget(null)}
          onMoved={() => { setBuildTarget(null); setReloadToken((t) => t + 1); }}
        />
      )}
    </Box>
  );
}

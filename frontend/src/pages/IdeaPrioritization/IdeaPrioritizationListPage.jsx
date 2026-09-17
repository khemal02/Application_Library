import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { ErrorBlock } from '../../components/common/AsyncState';
import useToast from '../../hooks/useToast';
import usePermission from '../../routes/usePermission';
import { applicationTrackingApi } from '../../services/domains';
import useBreadcrumbLabel from '../../hooks/useBreadcrumbLabel';
import MoveToBuildDialog from '../Ideas/MoveToBuildDialog';

// A track's own Development stage row — every track has exactly one. Eligible for this page's
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

/**
 * Idea Prioritization — a dedicated module (distinct from Application Tracking, by explicit
 * request) for exactly one job: deciding what gets built next, and starting it. Shows every
 * approved idea's track that's still waiting to start Development, in a manual build-sequence
 * order (`queue_rank` — see the reorder migration/service on applicationTracking.service.js).
 * Once a track is moved to build here, it drops off this page (queue_rank clears) and continues
 * its life on Application Tracking instead — this page only ever holds the "not started yet" set.
 *
 * Rank badges are visible to everyone; the drag handle, up/down arrows, and "Move to Build →"
 * button are missing entirely (not disabled) for a viewer without `ideas:moveToBuild` — the same
 * permission that already gates Move to Build on the merged Ideas/Feature Requests list, reused
 * here rather than a second grant (see applicationTracking.routes.js#reorder's own comment). That
 * list's own Build column stays exactly as it was — this page is a second, dedicated place to do
 * the same underlying action, not a replacement for it.
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

  const handleReorder = async (trackId, neighbors) => {
    try {
      await applicationTrackingApi.reorder(trackId, neighbors);
      setReloadToken((t) => t + 1);
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to reorder');
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>Idea Prioritization</Typography>

      {error ? (
        <ErrorBlock message={error} onRetry={loadTracks} />
      ) : (
        <Paper variant="outlined" sx={{ p: 2 }}>
          {!loading && waiting.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              Nothing waiting to start — approved ideas appear here until they're moved to build.
            </Typography>
          )}
          <Stack spacing={0}>
            {waiting.map((track, index) => (
              <Stack
                key={track.id}
                direction="row" alignItems="center" spacing={1.5}
                draggable={canManageQueue}
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex === null || dragIndex === index) return;
                  handleReorder(waiting[dragIndex].id, computeNeighbors(waiting, dragIndex, index));
                  setDragIndex(null);
                }}
                sx={{
                  py: 1.5,
                  borderBottom: index < waiting.length - 1 ? 1 : 0,
                  borderColor: 'divider',
                  opacity: dragIndex === index ? 0.4 : 1,
                  cursor: canManageQueue ? 'grab' : 'default',
                }}
              >
                {canManageQueue && (
                  <DragIndicatorIcon fontSize="small" color="disabled" sx={{ flex: '0 0 auto' }} />
                )}
                <Chip size="small" label={`#${index + 1}`} sx={{ flex: '0 0 auto', fontWeight: 700 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>{track.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {track.owner?.name || 'No owner yet'} · {track.priority ? track.priority[0].toUpperCase() + track.priority.slice(1) : '—'} priority
                  </Typography>
                </Box>
                {canManageQueue && (
                  <Stack direction="row" spacing={0}>
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
                  </Stack>
                )}
                {canManageQueue && (
                  <Button
                    size="small" variant="contained" color="info"
                    onClick={() => setBuildTarget(track)}
                  >
                    Move to Build →
                  </Button>
                )}
              </Stack>
            ))}
          </Stack>
        </Paper>
      )}

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

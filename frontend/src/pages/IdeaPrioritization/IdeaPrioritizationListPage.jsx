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
import usePageMeta from '../../hooks/usePageMeta';
import MoveToBuildDialog from '../Ideas/MoveToBuildDialog';
import { deriveStatusChip } from '../../utils/applicationTrackStatus';
import initials from '../../utils/initials';

// Matches DataTable.jsx's own header/row styling exactly (see its own comments) — this page can't
// use that shared component (drag-and-drop reorder, per-row action buttons, two separate tables),
// so its hand-rolled Table/TableCell markup carries the same look by hand instead.
const HEAD_CELL_SX = {
  fontWeight: 600, whiteSpace: 'nowrap', textTransform: 'uppercase',
  letterSpacing: '0.05em', fontSize: '0.75rem', color: 'text.disabled', padding: '14px 14px',
};
const BODY_CELL_SX = { padding: '16px 14px', fontSize: '14px' };

function PersonCell({ name }) {
  if (!name) return <Typography variant="body2" color="text.disabled">—</Typography>;
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Avatar sx={{ width: 24, height: 24, fontSize: '10.5px', fontWeight: 800, bgcolor: '#EAF2FE', color: '#1D4ED8' }}>
        {initials(name)}
      </Avatar>
      <Typography variant="body2">{name}</Typography>
    </Stack>
  );
}

/**
 * Computes the two queue items that should end up immediately before/after a moved item, given its
 * OLD index and desired FINAL index in `list` (already sorted by rank ascending). Shared by both
 * the up/down arrow buttons (toIndex = fromIndex ∓ 1) and drag-and-drop (toIndex = the row the
 * item was dropped onto) — same math either way, just a different `toIndex`. Items carry
 * `{itemType, id}` now (a track OR a change request), not a bare track id — see
 * applicationTracking.service.js#reorderQueueItem.
 */
function computeNeighbors(list, fromIndex, toIndex) {
  const reduced = list.filter((_, idx) => idx !== fromIndex);
  const insertAt = Math.max(0, Math.min(toIndex, reduced.length));
  const before = reduced[insertAt - 1] || null;
  const after = reduced[insertAt] || null;
  return {
    before: before ? { itemType: before.itemType, id: before.id } : null,
    after: after ? { itemType: after.itemType, id: after.id } : null,
  };
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

function ItemCell({ item }) {
  return (
    <Link component={RouterLink} to={item.detailPath} underline="hover" variant="body2" fontWeight={600}>
      {item.name}
    </Link>
  );
}

// The row-shape MoveToBuildDialog needs, built from a normalized queue item — see
// MoveToBuildDialog.jsx's own docstring for the exact `{_type, id, title, track?, changeRequest?,
// application?}` contract it expects.
function toMoveToBuildRow(item) {
  return item.itemType === 'track'
    ? { _type: 'idea', id: item.ideaId, title: item.name, track: { id: item.id, ownerId: item.ownerId } }
    : {
      _type: 'feature_request',
      id: item.featureRequestId,
      title: item.name,
      application: { id: item.changeRequestApplicationId },
      changeRequest: { id: item.id },
    };
}

/**
 * Idea Prioritization — a dedicated module (distinct from Application Tracking, by explicit
 * request) for exactly one job: deciding what gets built next, and starting it. Spans BOTH an
 * approved idea's track AND an approved feature request's (feature-request-sourced) change
 * request — the two share one combined ranked queue (applicationTracking.service.js#getQueue),
 * since both are, the moment they're ready, competing for the same development bandwidth. Two
 * tables: "Waiting to start" (queueRank set, manual build-sequence order) is the reorderable,
 * actionable one; everything else (already in progress, on hold, live, implemented, cancelled) is
 * shown below, read-only, for context — clearly labeled "not reorderable — work is underway"
 * rather than just silently missing.
 *
 * Reorder controls (drag handle + up/down arrows) and "Move to Build →" are per-row, not
 * per-table: a track row needs `ideas:moveToBuild`, a change-request row needs
 * `feature_requests:moveToBuild` — the same two permissions that already gate Move to Build on the
 * merged Ideas/Feature-Requests list, reused here rather than a third grant. Missing entirely, not
 * disabled, for a viewer without the matching permission.
 */
export default function IdeaPrioritizationListPage() {
  const { showError } = useToast();
  const canMoveIdeasToBuild = usePermission('ideas', 'moveToBuild');
  const canMoveFeatureRequestsToBuild = usePermission('feature_requests', 'moveToBuild');
  const canManageAnyQueue = canMoveIdeasToBuild || canMoveFeatureRequestsToBuild;
  useBreadcrumbLabel('Idea Prioritization');
  usePageMeta('Idea Prioritization', 'Set the build order for approved work.');

  const [queue, setQueue] = useState({ waiting: [], started: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [buildTarget, setBuildTarget] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const loadQueue = () => {
    setLoading(true);
    setError(null);
    applicationTrackingApi.getQueue()
      .then((res) => setQueue(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(loadQueue, [reloadToken]);

  const { waiting, started } = queue;

  const canManageItem = (item) => (item.itemType === 'track' ? canMoveIdeasToBuild : canMoveFeatureRequestsToBuild);

  const handleReorder = async (item, neighbors) => {
    try {
      await applicationTrackingApi.reorderQueue({ item: { itemType: item.itemType, id: item.id }, ...neighbors });
      setReloadToken((t) => t + 1);
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to reorder');
    }
  };

  if (loading) return null;
  if (error) return <ErrorBlock message={error} onRetry={loadQueue} />;

  return (
    <Box>

      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={HEAD_CELL_SX}>Order</TableCell>
              <TableCell sx={HEAD_CELL_SX}>Idea / Feature Request</TableCell>
              <TableCell sx={HEAD_CELL_SX}>Submitted By</TableCell>
              <TableCell sx={HEAD_CELL_SX}>Department</TableCell>
              {canManageAnyQueue && <TableCell sx={HEAD_CELL_SX} align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {waiting.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManageAnyQueue ? 5 : 4}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                    Nothing waiting to start — approved ideas and feature requests appear here until they&rsquo;re moved to build.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {waiting.map((item, index) => {
              const canManage = canManageItem(item);
              return (
                <TableRow
                  key={`${item.itemType}:${item.id}`}
                  draggable={canManage}
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex === null || dragIndex === index) return;
                    handleReorder(waiting[dragIndex], computeNeighbors(waiting, dragIndex, index));
                    setDragIndex(null);
                  }}
                  sx={{ opacity: dragIndex === index ? 0.4 : 1, cursor: canManage ? 'grab' : 'default' }}
                >
                  <TableCell sx={BODY_CELL_SX}>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      {canManage && <DragIndicatorIcon fontSize="small" color="disabled" />}
                      <OrderBadge>{index + 1}</OrderBadge>
                    </Stack>
                  </TableCell>
                  <TableCell sx={BODY_CELL_SX}><ItemCell item={item} /></TableCell>
                  <TableCell sx={BODY_CELL_SX}>
                    <PersonCell name={item.submitter?.name} />
                  </TableCell>
                  <TableCell sx={BODY_CELL_SX}>
                    <Typography variant="body2" color={item.department?.name ? 'text.primary' : 'text.disabled'}>
                      {item.department?.name || '—'}
                    </Typography>
                  </TableCell>
                  {canManageAnyQueue && (
                    <TableCell sx={BODY_CELL_SX} align="right">
                      {canManage ? (
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                          <Tooltip title="Move up">
                            <span>
                              <IconButton
                                size="small" disabled={index === 0}
                                onClick={() => handleReorder(item, computeNeighbors(waiting, index, index - 1))}
                              >
                                <KeyboardArrowUpIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Move down">
                            <span>
                              <IconButton
                                size="small" disabled={index === waiting.length - 1}
                                onClick={() => handleReorder(item, computeNeighbors(waiting, index, index + 1))}
                              >
                                <KeyboardArrowDownIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Button size="small" variant="contained" color="info" onClick={() => setBuildTarget(item)}>
                            Move to Build →
                          </Button>
                        </Stack>
                      ) : null}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
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
              <TableCell sx={HEAD_CELL_SX}>Order</TableCell>
              <TableCell sx={HEAD_CELL_SX}>Idea / Feature Request</TableCell>
              <TableCell sx={HEAD_CELL_SX}>Submitted By</TableCell>
              <TableCell sx={HEAD_CELL_SX}>Department</TableCell>
              <TableCell sx={HEAD_CELL_SX}>Status</TableCell>
              <TableCell sx={HEAD_CELL_SX}>Owner</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {started.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                    Nothing in progress yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {started.map((item) => {
              const isMuted = item.status === 'on_hold' || item.status === 'cancelled';
              return (
                <TableRow key={`${item.itemType}:${item.id}`} sx={{ opacity: isMuted ? 0.55 : 1 }}>
                  <TableCell sx={BODY_CELL_SX}><OrderBadge muted>—</OrderBadge></TableCell>
                  <TableCell sx={BODY_CELL_SX}><ItemCell item={item} /></TableCell>
                  <TableCell sx={BODY_CELL_SX}>
                    <PersonCell name={item.submitter?.name} />
                  </TableCell>
                  <TableCell sx={BODY_CELL_SX}>
                    <Typography variant="body2" color={item.department?.name ? 'text.primary' : 'text.disabled'}>
                      {item.department?.name || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={BODY_CELL_SX}>
                    {/* Deliberately always neutral gray here, ignoring deriveStatusChip's own
                        color bucket — color-coding by status is Application Tracking's own
                        column's job (see applicationTrackStatus.js), not duplicated in this
                        read-only "already underway" table. */}
                    <StatusBadge color="default" label={deriveStatusChip(item).label} />
                  </TableCell>
                  <TableCell sx={BODY_CELL_SX}>
                    <PersonCell name={item.owner?.name} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {buildTarget && (
        <MoveToBuildDialog
          row={toMoveToBuildRow(buildTarget)}
          onClose={() => setBuildTarget(null)}
          onMoved={() => { setBuildTarget(null); setReloadToken((t) => t + 1); }}
        />
      )}
    </Box>
  );
}

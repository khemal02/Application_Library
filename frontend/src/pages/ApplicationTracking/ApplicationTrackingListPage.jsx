import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import dayjs from 'dayjs';
import DataTable from '../../components/common/DataTable';
import StatusBadge from '../../components/common/StatusBadge';
import { ErrorBlock } from '../../components/common/AsyncState';
import useToast from '../../hooks/useToast';
import usePermission from '../../routes/usePermission';
import { applicationTrackingApi } from '../../services/domains';
import { useAppSelector } from '../../app/hooks';
import useBreadcrumbLabel from '../../hooks/useBreadcrumbLabel';
import { STAGE_ORDER, STAGE_LABELS, deriveStatusChip } from '../../utils/applicationTrackStatus';
import MoveToBuildDialog from '../Ideas/MoveToBuildDialog';

// Muted, not hidden (per spec) — on_hold/cancelled rows stay fully visible and clickable, just
// visually de-emphasized against active/live ones.
function MutedCell({ track, children }) {
  const isMuted = track.status === 'on_hold' || track.status === 'cancelled';
  return <Box sx={{ opacity: isMuted ? 0.55 : 1 }}>{children}</Box>;
}

/**
 * The Application column: the track's own (idea-resolved-or-overridden) name, a muted "Idea #N"
 * caption underneath. Once live, the name links to the real catalogue entry — EXCEPT when that
 * entry has since been deleted (C2): status stays honestly "Live", but a track is never left
 * either blank or pointing at a dead link — a muted line says plainly what happened instead.
 */
function ApplicationCell({ track }) {
  const isLive = track.status === 'live';
  const hasApplication = !!track.application;
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" fontWeight={600}>{track.name}</Typography>
      {isLive && !hasApplication && (
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', fontStyle: 'italic', mt: 0.25 }}>
          The application it produced has since been removed.
        </Typography>
      )}
    </Box>
  );
}

// A track's own Development stage row — every track has exactly one; used to decide "Waiting to
// start" eligibility the same way the backend does (applicationTracking.service.js#reorder/
// #moveToBuild): status 'active' AND Development still 'not_started'.
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
 * "Waiting to start" — active tracks whose Development stage hasn't begun, in manual build-
 * sequence order (queue_rank, see the reorder migration/service). Rank badges are always visible;
 * reorder controls (drag handle + up/down arrows — arrows are the reliable, accessible path, not
 * drag-only) and the "Move to Build →" button are missing entirely, not disabled, for a viewer
 * without `ideas:moveToBuild` — same "absent, not disabled" convention this permission already
 * follows on the merged Ideas/Feature Requests list.
 */
function WaitingToStartSection({
  tracks, canManage, onReorder, onOpenBuild,
}) {
  const [dragIndex, setDragIndex] = useState(null);

  if (tracks.length === 0) return null;

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Waiting to start</Typography>
      <Stack spacing={0}>
        {tracks.map((track, index) => (
          <Stack
            key={track.id}
            direction="row" alignItems="center" spacing={1.5}
            draggable={canManage}
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex === null || dragIndex === index) return;
              onReorder(tracks[dragIndex].id, computeNeighbors(tracks, dragIndex, index));
              setDragIndex(null);
            }}
            sx={{
              py: 1,
              borderBottom: index < tracks.length - 1 ? 1 : 0,
              borderColor: 'divider',
              opacity: dragIndex === index ? 0.4 : 1,
              cursor: canManage ? 'grab' : 'default',
            }}
          >
            {canManage && (
              <DragIndicatorIcon fontSize="small" color="disabled" sx={{ flex: '0 0 auto' }} />
            )}
            <Chip size="small" label={`#${index + 1}`} sx={{ flex: '0 0 auto', fontWeight: 700 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>{track.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {track.owner?.name || 'No owner yet'} · {track.priority ? track.priority[0].toUpperCase() + track.priority.slice(1) : '—'} priority
              </Typography>
            </Box>
            {canManage && (
              <Stack direction="row" spacing={0}>
                <Tooltip title="Move up">
                  <span>
                    <IconButton
                      size="small" disabled={index === 0}
                      onClick={() => onReorder(track.id, computeNeighbors(tracks, index, index - 1))}
                    >
                      <KeyboardArrowUpIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Move down">
                  <span>
                    <IconButton
                      size="small" disabled={index === tracks.length - 1}
                      onClick={() => onReorder(track.id, computeNeighbors(tracks, index, index + 1))}
                    >
                      <KeyboardArrowDownIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            )}
            {canManage && (
              <Button
                size="small" variant="contained" color="info"
                onClick={() => onOpenBuild(track)}
              >
                Move to Build →
              </Button>
            )}
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

/**
 * Application Tracking — the displayed name now matches the module/route/API name throughout
 * this module (it used to display as "Idea Prioritization", by explicit request). Sits between an
 * approved idea and the Applications catalogue. No create button (a track is only ever born from
 * an idea being approved)
 * and no search box (the backend list has none to back it — see applicationTracking.service.js#list,
 * which owns the order: priority-then-target-date normally, or start-date-first the moment either
 * "mine" toggle below is on — not a user-sortable column-header kind of order). `useServerList`
 * isn't used here for the same reason: it always injects `sort`/`search` query params this
 * endpoint's validator would 400 on.
 *
 * Split into two groups (Stage 2/B1): "Waiting to start" (active + Development not_started, manual
 * rank order) above, everything else below in an unchanged table. Fetches every matching track in
 * one call (limit 100, this app's real data volumes never approach that) rather than one server
 * page at a time — both groups need the FULL matching set to group/rank correctly, the same
 * reasoning the merged Ideas/Feature Requests list's own `fetchAllPages` follows; the "everything
 * else" table's own pagination is applied client-side over that full set instead.
 */
export default function ApplicationTrackingListPage() {
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const { showError } = useToast();
  // Same permission already gating Move to Build on the Ideas/Feature Requests list — reused here
  // verbatim, not a second grant (see applicationTracking.routes.js#reorder's own comment).
  const canManageQueue = usePermission('ideas', 'moveToBuild');
  useBreadcrumbLabel('Application Tracking');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [stageFilter, setStageFilter] = useState('');
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [myApps, setMyApps] = useState(false);
  const [allTracks, setAllTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [buildTarget, setBuildTarget] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const loadTracks = () => {
    setLoading(true);
    setError(null);
    const params = { limit: 100 };
    if (stageFilter) params.stage = stageFilter;
    if (assignedToMe && user?.id) params.assigneeId = user.id;
    if (myApps && user?.id) params.ownerId = user.id;
    applicationTrackingApi.list(params)
      .then((res) => setAllTracks(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load tracks'))
      .finally(() => setLoading(false));
  };

  useEffect(loadTracks, [stageFilter, assignedToMe, myApps, user?.id, reloadToken]);
  useEffect(() => { setPage(1); }, [stageFilter, assignedToMe, myApps]);

  const waiting = allTracks.filter(isWaitingToStart).sort((a, b) => (a.queueRank ?? 0) - (b.queueRank ?? 0));
  const others = allTracks.filter((t) => !isWaitingToStart(t));
  const pageRows = others.slice((page - 1) * limit, page * limit);
  const pagination = {
    page, limit, totalItems: others.length, totalPages: Math.max(Math.ceil(others.length / limit), 1),
  };

  const handleReorder = async (trackId, neighbors) => {
    try {
      await applicationTrackingApi.reorder(trackId, neighbors);
      setReloadToken((t) => t + 1);
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to reorder');
    }
  };

  const columns = [
    { key: 'application', label: 'Application', render: (t) => <MutedCell track={t}><ApplicationCell track={t} /></MutedCell> },
    {
      key: 'owner',
      label: 'Owner',
      render: (t) => (
        <MutedCell track={t}>
          <Typography variant="body2" color={t.owner?.name ? 'text.primary' : 'text.disabled'}>{t.owner?.name || '—'}</Typography>
        </MutedCell>
      ),
    },
    {
      key: 'startDate',
      label: 'Start Date',
      render: (t) => (
        <MutedCell track={t}>
          <Typography variant="body2" color={t.startDate ? 'text.primary' : 'text.disabled'}>
            {t.startDate ? dayjs(t.startDate).format('MMM D, YYYY') : '—'}
          </Typography>
        </MutedCell>
      ),
    },
    {
      key: 'targetGoLive',
      label: 'Expected Deployment Date',
      render: (t) => (
        <MutedCell track={t}>
          <Typography variant="body2" color={t.targetGoLive ? 'text.primary' : 'text.disabled'}>
            {t.targetGoLive ? dayjs(t.targetGoLive).format('MMM D, YYYY') : '—'}
          </Typography>
        </MutedCell>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (t) => {
        const chip = deriveStatusChip(t);
        return <MutedCell track={t}><StatusBadge color={chip.color} label={chip.label} /></MutedCell>;
      },
    },
  ];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap rowGap={1} sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="baseline" spacing={1}>
          <Typography variant="h5" fontWeight={700}>Application Tracking</Typography>
        </Stack>

        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            select size="small" label="Stage" value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">All stages</MenuItem>
            {STAGE_ORDER.map((s) => <MenuItem key={s} value={s}>{STAGE_LABELS[s]}</MenuItem>)}
          </TextField>
          <FormControlLabel
            control={(
              <Switch
                size="small" checked={assignedToMe}
                onChange={(e) => setAssignedToMe(e.target.checked)}
              />
            )}
            label="Assigned to me"
          />
          <FormControlLabel
            control={(
              <Switch
                size="small" checked={myApps}
                onChange={(e) => setMyApps(e.target.checked)}
              />
            )}
            label="My Apps"
          />
        </Stack>
      </Stack>

      {error ? (
        <ErrorBlock message={error} onRetry={loadTracks} />
      ) : (
        <>
          <WaitingToStartSection
            tracks={waiting}
            canManage={canManageQueue}
            onReorder={handleReorder}
            onOpenBuild={setBuildTarget}
          />
          <DataTable
            columns={columns}
            rows={pageRows}
            pagination={pagination}
            onPageChange={setPage}
            onRowsPerPageChange={(n) => { setLimit(n); setPage(1); }}
            onRowClick={(row) => navigate(`/application-tracking/${row.id}`)}
            loading={loading}
            emptyMessage="Approved new ideas appear here while they're being built."
          />
        </>
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

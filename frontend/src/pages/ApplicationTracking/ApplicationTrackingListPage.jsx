import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import dayjs from 'dayjs';
import DataTable from '../../components/common/DataTable';
import StatusBadge from '../../components/common/StatusBadge';
import { ErrorBlock } from '../../components/common/AsyncState';
import { applicationTrackingApi } from '../../services/domains';
import { useAppSelector } from '../../app/hooks';
import useBreadcrumbLabel from '../../hooks/useBreadcrumbLabel';
import { STAGE_ORDER, STAGE_LABELS, deriveStatusChip } from '../../utils/applicationTrackStatus';

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

/**
 * Idea Prioritization (displayed name; module/route/API still say "Application Tracking" — see
 * the file/route names throughout this module) — sits between an approved idea and the
 * Applications catalogue. No create button (a track is only ever born from an idea being approved)
 * and no search box (the backend list has none to back it — see applicationTracking.service.js#list,
 * which owns the order: priority-then-target-date normally, or start-date-first the moment either
 * "mine" toggle below is on — not a user-sortable column-header kind of order). `useServerList`
 * isn't used here for the same reason: it always injects `sort`/`search` query params this
 * endpoint's validator would 400 on.
 */
export default function ApplicationTrackingListPage() {
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  useBreadcrumbLabel('Idea Prioritization');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [stageFilter, setStageFilter] = useState('');
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [myApps, setMyApps] = useState(false);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = { page, limit };
    if (stageFilter) params.stage = stageFilter;
    if (assignedToMe && user?.id) params.assigneeId = user.id;
    if (myApps && user?.id) params.ownerId = user.id;
    applicationTrackingApi.list(params)
      .then((res) => { setRows(res.data); setPagination(res.meta?.pagination || null); })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load tracks'))
      .finally(() => setLoading(false));
  }, [page, limit, stageFilter, assignedToMe, myApps, user?.id]);

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
          <Typography variant="h5" fontWeight={700}>Idea Prioritization</Typography>
        </Stack>

        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            select size="small" label="Stage" value={stageFilter}
            onChange={(e) => { setStageFilter(e.target.value); setPage(1); }}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">All stages</MenuItem>
            {STAGE_ORDER.map((s) => <MenuItem key={s} value={s}>{STAGE_LABELS[s]}</MenuItem>)}
          </TextField>
          <FormControlLabel
            control={(
              <Switch
                size="small" checked={assignedToMe}
                onChange={(e) => { setAssignedToMe(e.target.checked); setPage(1); }}
              />
            )}
            label="Assigned to me"
          />
          <FormControlLabel
            control={(
              <Switch
                size="small" checked={myApps}
                onChange={(e) => { setMyApps(e.target.checked); setPage(1); }}
              />
            )}
            label="My Apps"
          />
        </Stack>
      </Stack>

      {error ? (
        <ErrorBlock message={error} onRetry={() => setPage((p) => p)} />
      ) : !loading && rows.length === 0 ? (
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 4, textAlign: 'center' }}>
          <Typography variant="body2" fontWeight={600}>Nothing being tracked yet</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Approved new ideas appear here while they&apos;re being built.
          </Typography>
        </Box>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          pagination={pagination}
          onPageChange={setPage}
          onRowsPerPageChange={(n) => { setLimit(n); setPage(1); }}
          onRowClick={(row) => navigate(`/application-tracking/${row.id}`)}
          loading={loading}
        />
      )}
    </Box>
  );
}

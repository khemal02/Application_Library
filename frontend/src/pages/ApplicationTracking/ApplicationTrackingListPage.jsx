import { useEffect, useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Link from '@mui/material/Link';
import dayjs from 'dayjs';
import DataTable from '../../components/common/DataTable';
import StatusBadge from '../../components/common/StatusBadge';
import { ErrorBlock } from '../../components/common/AsyncState';
import { applicationTrackingApi } from '../../services/domains';
import { useAppSelector } from '../../app/hooks';
import useBreadcrumbLabel from '../../hooks/useBreadcrumbLabel';
import {
  STAGE_ORDER, STAGE_LABELS, deriveStatusChip, currentStageLabel, stagePips, currentAssignee,
} from '../../utils/applicationTrackStatus';

// Same rule the Issues card uses for severity (SeverityChip in IssuesCard.jsx) — priority is
// outlined so it never competes visually with the filled Status chip in the same row; they answer
// two different questions ("how much it matters" vs "where it's got to").
const PRIORITY_META = {
  critical: { label: 'Critical', color: 'error' },
  high: { label: 'High', color: 'warning' },
  medium: { label: 'Medium', color: null },
  low: { label: 'Low', color: null },
};

function PriorityChip({ priority }) {
  const meta = PRIORITY_META[priority] || PRIORITY_META.medium;
  return <Chip size="small" variant="outlined" color={meta.color || 'default'} label={meta.label} />;
}

// Muted, not hidden (per spec) — on_hold/cancelled rows stay fully visible and clickable, just
// visually de-emphasized against active/live ones.
function MutedCell({ track, children }) {
  const isMuted = track.status === 'on_hold' || track.status === 'cancelled';
  return <Box sx={{ opacity: isMuted ? 0.55 : 1 }}>{children}</Box>;
}

function ProgressPips({ track }) {
  return (
    <Stack direction="row" spacing={0.5} aria-hidden="true">
      {stagePips(track).map((p) => (
        <Box
          key={p.stage}
          sx={{
            width: 8, height: 8, borderRadius: '50%',
            bgcolor: p.pipState === 'complete' ? 'success.main' : p.pipState === 'current' ? 'primary.main' : 'transparent',
            border: p.pipState === 'upcoming' ? '1px solid' : 'none',
            borderColor: 'divider',
          }}
        />
      ))}
    </Stack>
  );
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
      {isLive && hasApplication ? (
        <Link
          component={RouterLink} to={`/applications/${track.application.id}`}
          onClick={(e) => e.stopPropagation()} variant="body2" fontWeight={600}
          sx={{ display: 'block' }}
        >
          {track.name}
        </Link>
      ) : (
        <Typography variant="body2" fontWeight={600}>{track.name}</Typography>
      )}
      {track.idea && (
        <Link
          component={RouterLink} to={`/ideas/${track.idea.id}`}
          onClick={(e) => e.stopPropagation()} variant="caption" color="text.secondary"
          sx={{ display: 'block', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
        >
          Idea #{track.idea.ideaNumber}
        </Link>
      )}
      {isLive && !hasApplication && (
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', fontStyle: 'italic', mt: 0.25 }}>
          The application it produced has since been removed.
        </Typography>
      )}
    </Box>
  );
}

/**
 * Application Tracking — the module between an approved idea and the Applications catalogue. No
 * create button (a track is only ever born from an idea being approved) and no search box (the
 * backend list has none to back it — see applicationTracking.service.js#list, which owns a fixed
 * priority-then-target-date order, not a user-sortable one). `useServerList` isn't used here for
 * the same reason: it always injects `sort`/`search` query params this endpoint's validator would
 * 400 on.
 */
export default function ApplicationTrackingListPage() {
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  useBreadcrumbLabel('Application Tracking');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [stageFilter, setStageFilter] = useState('');
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // A separate, unfiltered fetch purely to compute the header's status breakdown — same
  // "fetch once, compute client-side" reasoning ChangeRequestsCard.jsx applies with its own
  // {limit:100} call, rather than a dedicated stats endpoint for a handful of numbers.
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = { page, limit };
    if (stageFilter) params.stage = stageFilter;
    if (assignedToMe && user?.id) params.assigneeId = user.id;
    applicationTrackingApi.list(params)
      .then((res) => { setRows(res.data); setPagination(res.meta?.pagination || null); })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load tracks'))
      .finally(() => setLoading(false));
  }, [page, limit, stageFilter, assignedToMe, user?.id]);

  // D1: two cheap {limit:1} calls reading pagination.totalItems, not a {limit:100} fetch with
  // includes just to count two numbers client-side — correct regardless of how many tracks exist,
  // where the old approach would have silently undercounted past 100.
  useEffect(() => {
    Promise.all([
      applicationTrackingApi.list({ status: 'active', limit: 1 }),
      applicationTrackingApi.list({ status: 'on_hold', limit: 1 }),
    ]).then(([activeRes, onHoldRes]) => setSummary({
      inFlight: activeRes.meta?.pagination?.totalItems ?? 0,
      onHold: onHoldRes.meta?.pagination?.totalItems ?? 0,
    })).catch(() => setSummary(null));
  }, []);

  const headerCount = summary && (
    summary.onHold > 0 ? `${summary.inFlight} in flight · ${summary.onHold} on hold` : `${summary.inFlight} in flight`
  );

  const columns = [
    { key: 'priority', label: 'Priority', render: (t) => <MutedCell track={t}><PriorityChip priority={t.priority} /></MutedCell> },
    { key: 'application', label: 'Application', render: (t) => <MutedCell track={t}><ApplicationCell track={t} /></MutedCell> },
    { key: 'stage', label: 'Stage', render: (t) => <MutedCell track={t}><Typography variant="body2">{currentStageLabel(t)}</Typography></MutedCell> },
    { key: 'progress', label: 'Progress', render: (t) => <MutedCell track={t}><ProgressPips track={t} /></MutedCell> },
    {
      key: 'assignedNow',
      label: 'Assigned now',
      render: (t) => {
        const assignee = currentAssignee(t);
        return (
          <MutedCell track={t}>
            <Typography variant="body2" color={assignee ? 'text.primary' : 'text.disabled'}>{assignee?.name || '—'}</Typography>
          </MutedCell>
        );
      },
    },
    {
      key: 'target',
      label: 'Target',
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
          {headerCount && <Typography variant="body2" color="text.secondary">{headerCount}</Typography>}
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

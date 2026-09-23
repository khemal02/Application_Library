import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';
import Popover from '@mui/material/Popover';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import InputAdornment from '@mui/material/InputAdornment';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import { alpha } from '@mui/material/styles';
import useToast from '../../hooks/useToast';
import usePermission from '../../routes/usePermission';
import { ideasApi, featureRequestsApi, departmentsApi } from '../../services/domains';
import DataTable from '../../components/common/DataTable';
import StatusBadge from '../../components/common/StatusBadge';
import avatarColor from '../../utils/avatarColor';
import { IDEA_STATUS_OPTIONS, INDUSTRY_OPTIONS, FUNCTIONAL_AREA_OPTIONS, ideaStatusLabel } from '../../constants/options';
import IdeaFormDialog from './IdeaFormDialog';
import FeatureRequestFormDialog from './FeatureRequestFormDialog';
import MoveToBuildDialog from './MoveToBuildDialog';

// Same blue/orange pairing used for the Type column's pill and each row's left accent border —
// blue for a brand-new idea, orange for a feature request against an existing application.
const TYPE_META = {
  idea: { label: 'New Idea', color: '#2563eb', icon: LightbulbOutlinedIcon },
  feature_request: { label: 'Feature Request', color: '#d97706', icon: BuildOutlinedIcon },
};

function TypeBadge({ type }) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  return (
    <Chip
      size="small"
      icon={<Icon fontSize="small" />}
      label={meta.label}
      sx={{ bgcolor: alpha(meta.color, 0.12), color: meta.color, border: 'none', '& .MuiChip-icon': { color: 'inherit' } }}
    />
  );
}

// The three LIVE idea statuses (see constants/options.js's LIVE_IDEA_STATUSES) — every row this
// page can ever show is one of these, so each gets its own real icon rather than forcing a
// two-way waiting/done split onto what's actually a three-way outcome.
const STATUS_ICONS = {
  under_review: HourglassEmptyOutlinedIcon,
  approved: CheckCircleOutlineIcon,
  rejected: CancelOutlinedIcon,
};

// Merging two independently-paginated sources into one client-side array (per the merge spec)
// means each source needs its OWN real total, not just its first page — otherwise a filter that
// matches more than one page of, say, ideas would silently drop rows past page 1. 100 is the
// backend's own hard per-request cap (see backend/src/utils/paginate.js's MAX_LIMIT); the 10-page
// ceiling here is just a sane safety stop, not a real limit this app's data volumes approach.
const MAX_PAGES_PER_SOURCE = 10;

async function fetchAllPages(listFn, params) {
  const first = await listFn({ ...params, page: 1, limit: 100 });
  let rows = first.data;
  const totalPages = first.meta?.pagination?.totalPages || 1;
  for (let page = 2; page <= Math.min(totalPages, MAX_PAGES_PER_SOURCE); page += 1) {
    // eslint-disable-next-line no-await-in-loop
    const next = await listFn({ ...params, page, limit: 100 });
    rows = rows.concat(next.data);
  }
  return rows;
}

// A row's own Development-stage data, wherever it actually lives — an idea's `track.stages[0]`
// (filtered server-side to 'development', see ideas.service.js's `include`) or a feature
// request's `changeRequest.stages[0]` (same filter, changeRequests side). Both are `undefined`
// until the idea/feature request is actually approved (the nested association is only ever
// non-null once a track/change request exists).
function developmentStage(row) {
  return row._type === 'idea' ? row.track?.stages?.[0] : row.changeRequest?.stages?.[0];
}

/**
 * The "Build" column's cell — visible at all only when the viewer holds the new, narrow
 * `moveToBuild` permission for THIS row's type (checked per row, not just once for the whole
 * column, since a viewer could in principle hold it for ideas but not feature requests). Approving
 * is now a plain approve/reject decision on both sides — it no longer picks an idea's track owner
 * either (that moved here too, see ideas.service.js#finalizeIdea's own comment) — so Move to Build
 * is where BOTH "who owns this" (ideas only — a feature request's Application already has one) and
 * "who's actually doing the Development work" get decided, in one step.
 */
function BuildCell({ row, canAct, onOpen }) {
  if (!canAct || row.status !== 'approved') {
    return <Typography variant="body2" color="text.disabled">—</Typography>;
  }
  const stage = developmentStage(row);
  if (!stage) return <Typography variant="body2" color="text.disabled">—</Typography>;
  // Always the same "Move to Build" button — it just disables itself once Development is no
  // longer not_started, deliberately never swapping to a status readout or a name.
  return (
    <Button
      size="small" variant="contained" color="info"
      disabled={stage.status !== 'not_started'}
      onClick={(e) => { e.stopPropagation(); onOpen(row); }}
    >
      Move to Build
    </Button>
  );
}

/**
 * Merges the two previously-separate "New Ideas" and "Modify Current Application" list screens
 * into one. Both source endpoints (ideasApi.list / featureRequestsApi.list) are called exactly as
 * they always were — same query param names, same filter/search/sort semantics — this page just
 * fetches from both, tags each row with its real type, and merges client-side; no backend change.
 * Rendered at both /ideas and /feature-requests (see AppRoutes.jsx) so neither existing link or
 * bookmark breaks.
 */
export default function IdeasAndFeatureRequestsListPage() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  // Real, independent RBAC checks — 'ideas' and 'feature_requests' are two distinct resources
  // (see ideas.routes.js / featureRequests.routes.js), even though every role seeded today happens
  // to hold both. A viewer who only has one sees only that one's button and rows.
  const canSeeIdeas = usePermission('ideas', 'read');
  const canSeeFeatureRequests = usePermission('feature_requests', 'read');
  // Narrower than the above (D3) — held today by CEO/Manager/Admin via their existing
  // resource-level `manage` grant, nobody else. Checked per row's own type, not just once, since
  // the two are independent permissions even though every role holding one happens to hold both.
  const canMoveIdeasToBuild = usePermission('ideas', 'moveToBuild');
  const canMoveFeatureRequestsToBuild = usePermission('feature_requests', 'moveToBuild');

  // A Dashboard stat tile links here with ?status=... or ?awaitingMyReview=true&kind=reviewer|
  // approver (for either "...for New Idea" or "...for Feature Request") — read once at mount, same
  // convention both original pages used individually.
  const [searchParams] = useSearchParams();
  const initialFilters = {};
  if (searchParams.get('status')) initialFilters.status = searchParams.get('status');
  if (searchParams.get('awaitingMyReview')) initialFilters.awaitingMyReview = searchParams.get('awaitingMyReview');
  if (searchParams.get('kind')) initialFilters.kind = searchParams.get('kind');

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState({ field: 'createdAt', direction: 'desc' });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [ideaFormOpen, setIdeaFormOpen] = useState(false);
  const [featureRequestFormOpen, setFeatureRequestFormOpen] = useState(false);
  const [buildTarget, setBuildTarget] = useState(null);
  // Bumped after a successful move-to-build to re-run the fetch effect below — "never patch local
  // state, always refetch and re-render from the response" (same rule every stage-action page in
  // this app follows), rather than reaching into `allRows` to hand-patch one row's nested stage.
  const [reloadToken, setReloadToken] = useState(0);
  const [filtersAnchor, setFiltersAnchor] = useState(null);
  // The row-level "Awaiting review" tag needs to know per-row, all the time — not just while the
  // toggle itself is on — whether the viewer has an open panel vote on it. There's no such flag on
  // the plain list response (only getById's `panel` has that), so this calls the exact same
  // awaitingMyReview=true endpoints the toggle already uses, unconditionally, purely to build a
  // lookup set — same source of truth, no new backend logic.
  const [awaitingIds, setAwaitingIds] = useState(new Set());

  useEffect(() => {
    departmentsApi.list({ limit: 100 }).then((res) => setDepartments(res.data)).catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      canSeeIdeas ? fetchAllPages(ideasApi.list, { awaitingMyReview: 'true' }) : Promise.resolve([]),
      canSeeFeatureRequests ? fetchAllPages(featureRequestsApi.list, { awaitingMyReview: 'true' }) : Promise.resolve([]),
    ]).then(([ideaRows, featureRequestRows]) => {
      if (cancelled) return;
      setAwaitingIds(new Set([...ideaRows, ...featureRequestRows].map((r) => r.id)));
    }).catch(() => { if (!cancelled) setAwaitingIds(new Set()); });
    return () => { cancelled = true; };
  }, [canSeeIdeas, canSeeFeatureRequests, reloadToken]);

  // Every one of these is a real param both endpoints already accept identically — Type is
  // deliberately excluded, it's a client-only filter applied after the merge below, neither
  // backend list endpoint has ever heard of it.
  const sharedParams = useMemo(() => {
    const p = {};
    if (search) p.search = search;
    if (filters.status) p.status = filters.status;
    if (filters.departmentId) p.departmentId = filters.departmentId;
    if (filters.industry) p.industry = filters.industry;
    if (filters.functionalArea) p.functionalArea = filters.functionalArea;
    if (filters.awaitingMyReview) p.awaitingMyReview = filters.awaitingMyReview;
    if (filters.kind) p.kind = filters.kind;
    return p;
  }, [search, filters.status, filters.departmentId, filters.industry, filters.functionalArea, filters.awaitingMyReview, filters.kind]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      canSeeIdeas ? fetchAllPages(ideasApi.list, sharedParams) : Promise.resolve([]),
      canSeeFeatureRequests ? fetchAllPages(featureRequestsApi.list, sharedParams) : Promise.resolve([]),
    ])
      .then(([ideaRows, featureRequestRows]) => {
        if (cancelled) return;
        setAllRows([
          ...ideaRows.map((r) => ({ ...r, _type: 'idea' })),
          ...featureRequestRows.map((r) => ({ ...r, _type: 'feature_request' })),
        ]);
      })
      .catch((err) => { if (!cancelled) showError(err.response?.data?.message || 'Failed to load'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedParams, canSeeIdeas, canSeeFeatureRequests, reloadToken]);

  useEffect(() => { setPage(1); }, [search, filters, sort]);

  // Type never touches the server — both sources are already fully fetched, so narrowing to one
  // type is just an in-memory filter over rows that are already there.
  const filteredRows = filters.type ? allRows.filter((r) => r._type === filters.type) : allRows;

  const sortedRows = useMemo(() => {
    const rows = [...filteredRows];
    const dir = sort.direction === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const av = a[sort.field];
      const bv = b[sort.field];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return rows;
  }, [filteredRows, sort]);

  const totalItems = sortedRows.length;
  const pagination = { page, limit, totalItems, totalPages: Math.max(Math.ceil(totalItems / limit), 1) };
  const pageRows = sortedRows.slice((page - 1) * limit, page * limit);

  // Segment counts reflect the currently server-filtered set (allRows, before the client-only
  // Type narrowing) — so switching segments always shows where the OTHER active filters currently
  // leave you, not a stale count from before this page's other filters were applied.
  const typeCounts = {
    all: allRows.length,
    idea: allRows.filter((r) => r._type === 'idea').length,
    feature_request: allRows.filter((r) => r._type === 'feature_request').length,
  };
  // The summary line's breakdown, unlike the segment counts above, reflects the FINAL filtered set
  // (Type included) — it's describing what's actually in the table right now, not what each other
  // segment would show.
  const resultBreakdown = {
    idea: filteredRows.filter((r) => r._type === 'idea').length,
    feature_request: filteredRows.filter((r) => r._type === 'feature_request').length,
  };

  const toggleAwaitingMyReview = (checked) => {
    const next = { ...filters };
    if (checked) next.awaitingMyReview = 'true';
    else delete next.awaitingMyReview;
    setFilters(next);
  };

  // Mirrors FilterBar's own handleFilterChange exactly — same "'' or undefined deletes the key"
  // rule — since these five fields still ultimately feed the identical sharedParams/filters state
  // FilterBar used to drive, just from inside a popover instead of six inline dropdowns.
  const handleFilterChange = (key, value) => {
    const next = { ...filters };
    if (value === '' || value === undefined) delete next[key];
    else next[key] = value;
    setFilters(next);
  };

  const handleTypeChange = (e, value) => {
    if (value === null) return; // exclusive ToggleButtonGroup emits null on a re-click of the
    // already-selected segment — ignored, since "All" is its own explicit segment for that.
    const next = { ...filters };
    if (value) next.type = value;
    else delete next.type;
    setFilters(next);
  };

  const FILTER_PANEL_KEYS = ['departmentId', 'industry', 'functionalArea', 'status'];
  const activeFilterCount = FILTER_PANEL_KEYS.filter((k) => filters[k]).length + (filters.awaitingMyReview === 'true' ? 1 : 0);
  const clearAllFilters = () => {
    const next = { ...filters };
    FILTER_PANEL_KEYS.forEach((k) => delete next[k]);
    delete next.awaitingMyReview;
    setFilters(next);
  };

  const columns = [
    {
      key: 'title',
      label: 'Title',
      sortable: true,
      render: (r) => (
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2">{r.title}</Typography>
          {awaitingIds.has(r.id) && (
            <Chip size="small" color="primary" label="Awaiting review" sx={{ height: 20, fontSize: 11 }} />
          )}
        </Stack>
      ),
    },
    { key: 'type', label: 'Type', render: (r) => <TypeBadge type={r._type} /> },
    {
      key: 'submitter',
      label: 'Submitted By',
      render: (r) => (
        <Stack direction="row" spacing={1} alignItems="center">
          <Avatar sx={{ width: 24, height: 24, fontSize: 12, bgcolor: avatarColor(r.submitter?.id || r.submitter?.name), color: '#fff' }}>
            {r.submitter?.name?.[0] || '?'}
          </Avatar>
          <Typography variant="body2">{r.submitter?.name || '—'}</Typography>
        </Stack>
      ),
    },
    { key: 'department', label: 'Department', render: (r) => r.department?.name || '—' },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (r) => {
        const Icon = STATUS_ICONS[r.status];
        return (
          <StatusBadge
            value={r.status}
            label={ideaStatusLabel(r.status)}
            icon={Icon ? <Icon fontSize="small" /> : undefined}
          />
        );
      },
    },
  ];
  // Whole column omitted, not just its buttons, when the viewer holds neither moveToBuild
  // permission — a plain reviewer shouldn't see a column of dashes on every row.
  if (canMoveIdeasToBuild || canMoveFeatureRequestsToBuild) {
    columns.push({
      key: 'build',
      label: 'Build',
      render: (r) => (
        <BuildCell
          row={r}
          canAct={r._type === 'idea' ? canMoveIdeasToBuild : canMoveFeatureRequestsToBuild}
          onOpen={setBuildTarget}
        />
      ),
    });
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap rowGap={1} sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Ideas</Typography>
        {/* Both buttons reused exactly as they exist on their own original pages — same label,
            same variant/icon, same onClick opening the same unmodified dialog — just relocated to
            sit together here. */}
        <Stack direction="row" spacing={1}>
          {canSeeIdeas && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIdeaFormOpen(true)} sx={{ borderRadius: 999 }}>Submit Idea</Button>
          )}
          {canSeeFeatureRequests && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFeatureRequestFormOpen(true)} sx={{ borderRadius: 999 }}>Submit Feature Request</Button>
          )}
        </Stack>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems={{ sm: 'center' }} flexWrap="wrap" useFlexGap rowGap={2} sx={{ mb: 2.5 }}>
        <TextField
          size="small"
          placeholder="Search ideas and feature requests..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 320, flexShrink: 0 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />

        <ToggleButtonGroup
          size="small" exclusive value={filters.type || ''} onChange={handleTypeChange}
          sx={{
            bgcolor: 'action.hover', borderRadius: 999, p: 0.5, gap: 0.5,
            '& .MuiToggleButtonGroup-grouped': {
              border: 0, borderRadius: '999px !important', textTransform: 'none', px: 1.5,
              '&.Mui-selected': { bgcolor: 'background.paper', boxShadow: 1, '&:hover': { bgcolor: 'background.paper' } },
            },
          }}
        >
          <ToggleButton value="">All ({typeCounts.all})</ToggleButton>
          <ToggleButton value="idea">
            <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: TYPE_META.idea.color, mr: 1 }} />
            New Ideas ({typeCounts.idea})
          </ToggleButton>
          <ToggleButton value="feature_request">
            <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: TYPE_META.feature_request.color, mr: 1 }} />
            Feature Requests ({typeCounts.feature_request})
          </ToggleButton>
        </ToggleButtonGroup>

        <Badge badgeContent={activeFilterCount} color="primary" invisible={activeFilterCount === 0}>
          <Button
            variant="outlined" size="small" color="inherit"
            startIcon={<FilterListIcon fontSize="small" />}
            onClick={(e) => setFiltersAnchor(e.currentTarget)}
            sx={{ borderRadius: 999 }}
          >
            Filters
          </Button>
        </Badge>
      </Stack>

      <Popover
        open={!!filtersAnchor}
        anchorEl={filtersAnchor}
        onClose={() => setFiltersAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, width: 280 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Filters</Typography>
          <Stack spacing={1.5}>
            <TextField
              select fullWidth size="small" label="Department"
              value={filters.departmentId ?? ''} onChange={(e) => handleFilterChange('departmentId', e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {departments.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
            </TextField>
            <TextField
              select fullWidth size="small" label="Industry"
              value={filters.industry ?? ''} onChange={(e) => handleFilterChange('industry', e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {INDUSTRY_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </TextField>
            <TextField
              select fullWidth size="small" label="Functional Area"
              value={filters.functionalArea ?? ''} onChange={(e) => handleFilterChange('functionalArea', e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {FUNCTIONAL_AREA_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </TextField>
            <TextField
              select fullWidth size="small" label="Status"
              value={filters.status ?? ''} onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {IDEA_STATUS_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </TextField>
            <FormControlLabel
              control={(
                <Switch
                  size="small"
                  checked={filters.awaitingMyReview === 'true'}
                  onChange={(e) => toggleAwaitingMyReview(e.target.checked)}
                />
              )}
              label="Awaiting my review"
            />
          </Stack>
          <Divider sx={{ my: 2 }} />
          <Stack direction="row" justifyContent="space-between">
            <Button size="small" onClick={clearAllFilters} disabled={activeFilterCount === 0}>Clear all</Button>
            <Button size="small" variant="contained" onClick={() => setFiltersAnchor(null)}>Done</Button>
          </Stack>
        </Box>
      </Popover>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {totalItems} result{totalItems === 1 ? '' : 's'} · {resultBreakdown.idea} New Idea{resultBreakdown.idea === 1 ? '' : 's'} · {resultBreakdown.feature_request} Feature Request{resultBreakdown.feature_request === 1 ? '' : 's'}
      </Typography>

      <DataTable
        columns={columns}
        rows={pageRows}
        pagination={pagination}
        sort={sort}
        onSortChange={setSort}
        onPageChange={setPage}
        onRowsPerPageChange={(n) => { setLimit(n); setPage(1); }}
        onRowClick={(row) => navigate(row._type === 'idea' ? `/ideas/${row.id}` : `/feature-requests/${row.id}`)}
        rowAccentColor={(row) => TYPE_META[row._type]?.color}
        loading={loading}
        emptyMessage="Nothing submitted yet — be the first!"
      />

      {canSeeIdeas && (
        <IdeaFormDialog
          open={ideaFormOpen}
          onClose={() => setIdeaFormOpen(false)}
          onCreated={(idea) => { setIdeaFormOpen(false); showSuccess('Idea submitted'); navigate(`/ideas/${idea.id}`); }}
        />
      )}
      {canSeeFeatureRequests && (
        <FeatureRequestFormDialog
          open={featureRequestFormOpen}
          onClose={() => setFeatureRequestFormOpen(false)}
          onCreated={(featureRequest) => { setFeatureRequestFormOpen(false); showSuccess('Feature request submitted'); navigate(`/feature-requests/${featureRequest.id}`); }}
        />
      )}

      {buildTarget && (
        <MoveToBuildDialog
          row={buildTarget}
          onClose={() => setBuildTarget(null)}
          onMoved={() => { setBuildTarget(null); setReloadToken((t) => t + 1); }}
        />
      )}
    </Box>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import AddIcon from '@mui/icons-material/Add';
import useToast from '../../hooks/useToast';
import usePermission from '../../routes/usePermission';
import { ideasApi, featureRequestsApi, departmentsApi } from '../../services/domains';
import DataTable from '../../components/common/DataTable';
import FilterBar from '../../components/common/FilterBar';
import StatusBadge from '../../components/common/StatusBadge';
import { IDEA_STATUS_OPTIONS, INDUSTRY_OPTIONS, FUNCTIONAL_AREA_OPTIONS, ideaStatusLabel } from '../../constants/options';
import humanize from '../../utils/humanize';
import IdeaFormDialog from './IdeaFormDialog';
import FeatureRequestFormDialog from './FeatureRequestFormDialog';

// New in the merged view — neither source list had a Type filter of its own, so there's no
// existing option list to reuse here (unlike Status/Industry/Functional Area below).
const TYPE_OPTIONS = [
  { value: 'idea', label: 'New Idea' },
  { value: 'feature_request', label: 'Feature Request' },
];

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

  useEffect(() => {
    departmentsApi.list({ limit: 100 }).then((res) => setDepartments(res.data)).catch(() => setDepartments([]));
  }, []);

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
  }, [sharedParams, canSeeIdeas, canSeeFeatureRequests]);

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

  const toggleAwaitingMyReview = (checked) => {
    const next = { ...filters };
    if (checked) next.awaitingMyReview = 'true';
    else delete next.awaitingMyReview;
    setFilters(next);
  };

  const columns = [
    { key: 'title', label: 'Title', sortable: true },
    {
      key: 'type',
      label: 'Type',
      render: (r) => (r._type === 'idea'
        ? <Chip size="small" variant="outlined" color="primary" label="New Idea" />
        : <Chip size="small" variant="outlined" color="secondary" label="Feature Request" />),
    },
    { key: 'submitter', label: 'Submitted By', render: (r) => r.submitter?.name || '—' },
    { key: 'department', label: 'Department', render: (r) => r.department?.name || '—' },
    { key: 'industry', label: 'Industry', render: (r) => (r.industry ? humanize(r.industry) : '—') },
    { key: 'functionalArea', label: 'Functional Area', render: (r) => (r.functionalArea ? humanize(r.functionalArea) : '—') },
    { key: 'status', label: 'Status', sortable: true, render: (r) => <StatusBadge value={r.status} label={ideaStatusLabel(r.status)} /> },
  ];

  const filterDefs = [
    { key: 'type', label: 'Type', options: TYPE_OPTIONS },
    { key: 'status', label: 'Status', options: IDEA_STATUS_OPTIONS },
    { key: 'departmentId', label: 'Department', options: departments.map((d) => ({ value: d.id, label: d.name })) },
    { key: 'industry', label: 'Industry', options: INDUSTRY_OPTIONS },
    { key: 'functionalArea', label: 'Functional Area', options: FUNCTIONAL_AREA_OPTIONS },
  ];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap rowGap={1} sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Ideas</Typography>
        {/* Both buttons reused exactly as they exist on their own original pages — same label,
            same variant/icon, same onClick opening the same unmodified dialog — just relocated to
            sit together here. */}
        <Stack direction="row" spacing={1}>
          {canSeeIdeas && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIdeaFormOpen(true)}>Submit Idea</Button>
          )}
          {canSeeFeatureRequests && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFeatureRequestFormOpen(true)}>Submit Feature Request</Button>
          )}
        </Stack>
      </Stack>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFiltersChange={setFilters}
        filterDefs={filterDefs}
        searchPlaceholder="Search ideas and feature requests..."
        right={(
          <Stack direction="row" spacing={1} alignItems="center">
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
        )}
      />

      <DataTable
        columns={columns}
        rows={pageRows}
        pagination={pagination}
        sort={sort}
        onSortChange={setSort}
        onPageChange={setPage}
        onRowsPerPageChange={(n) => { setLimit(n); setPage(1); }}
        onRowClick={(row) => navigate(row._type === 'idea' ? `/ideas/${row.id}` : `/feature-requests/${row.id}`)}
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
    </Box>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import AddIcon from '@mui/icons-material/Add';
import useServerList from '../../hooks/useServerList';
import useToast from '../../hooks/useToast';
import { ideasApi, departmentsApi } from '../../services/domains';
import DataTable from '../../components/common/DataTable';
import FilterBar from '../../components/common/FilterBar';
import StatusBadge from '../../components/common/StatusBadge';
import { IDEA_STATUS_OPTIONS, INDUSTRY_OPTIONS, FUNCTIONAL_AREA_OPTIONS, ideaStatusLabel } from '../../constants/options';
import humanize from '../../utils/humanize';
import IdeaFormDialog from './IdeaFormDialog';

export default function IdeasListPage() {
  const navigate = useNavigate();
  const { showSuccess } = useToast();
  // A Dashboard stat tile links here with ?status=... (e.g. "Pending Ideas") or
  // ?awaitingMyReview=true&kind=reviewer|approver ("My Review for New Idea" / "My Approve for New
  // Idea") — read once at mount.
  const [searchParams] = useSearchParams();
  const initialFilters = {};
  if (searchParams.get('status')) initialFilters.status = searchParams.get('status');
  if (searchParams.get('awaitingMyReview')) initialFilters.awaitingMyReview = searchParams.get('awaitingMyReview');
  if (searchParams.get('kind')) initialFilters.kind = searchParams.get('kind');
  const list = useServerList(ideasApi.list, {
    initialSort: { field: 'ideaNumber', direction: 'desc' },
    initialFilters: Object.keys(initialFilters).length ? initialFilters : undefined,
  });
  const [formOpen, setFormOpen] = useState(false);
  const [departments, setDepartments] = useState([]);

  // Display/org-chart only — isn't collected on the submit form (auto-filled from the submitter),
  // and doesn't drive who reviews an idea: the review panel is composed manually, person by
  // person, not routed by any field on the idea (see ideas.service.js#addParticipants).
  useEffect(() => {
    departmentsApi.list({ limit: 100 }).then((res) => setDepartments(res.data)).catch(() => setDepartments([]));
  }, []);

  const columns = [
    { key: 'title', label: 'Title', sortable: true },
    { key: 'submitter', label: 'Submitted By', render: (r) => r.submitter?.name || '—' },
    { key: 'department', label: 'Department', render: (r) => r.department?.name || '—' },
    { key: 'industry', label: 'Industry', render: (r) => (r.industry ? humanize(r.industry) : '—') },
    { key: 'functionalArea', label: 'Functional Area', render: (r) => (r.functionalArea ? humanize(r.functionalArea) : '—') },
    { key: 'status', label: 'Status', sortable: true, render: (r) => <StatusBadge value={r.status} label={ideaStatusLabel(r.status)} /> },
  ];

  const toggleAwaitingMyReview = (checked) => {
    const next = { ...list.filters };
    if (checked) next.awaitingMyReview = 'true';
    else delete next.awaitingMyReview;
    list.setFilters(next);
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>New Application Ideas</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>Submit Idea</Button>
      </Stack>

      <FilterBar
        search={list.search}
        onSearchChange={list.setSearch}
        filters={list.filters}
        onFiltersChange={list.setFilters}
        filterDefs={[
          { key: 'status', label: 'Status', options: IDEA_STATUS_OPTIONS },
          { key: 'departmentId', label: 'Department', options: departments.map((d) => ({ value: d.id, label: d.name })) },
          { key: 'industry', label: 'Industry', options: INDUSTRY_OPTIONS },
          { key: 'functionalArea', label: 'Functional Area', options: FUNCTIONAL_AREA_OPTIONS },
        ]}
        searchPlaceholder="Search ideas..."
        right={(
          <Stack direction="row" spacing={1} alignItems="center">
            {/* Any active user can be a panel reviewer or approver now (see
                ideas.service.js#addParticipants) — not gated to a specific permission the way the
                old team_lead/manager/ceo chain was. */}
            <FormControlLabel
              control={(
                <Switch
                  size="small"
                  checked={list.filters.awaitingMyReview === 'true'}
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
        rows={list.rows}
        pagination={list.pagination}
        sort={list.sort}
        onSortChange={list.setSort}
        onPageChange={list.setPage}
        onRowsPerPageChange={list.setLimit}
        onRowClick={(row) => navigate(`/ideas/${row.id}`)}
        loading={list.loading}
        emptyMessage="No ideas submitted yet — be the first!"
      />

      <IdeaFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={(idea) => { setFormOpen(false); showSuccess('Idea submitted'); navigate(`/ideas/${idea.id}`); }}
      />
    </Box>
  );
}

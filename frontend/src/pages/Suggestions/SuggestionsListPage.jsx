import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import AddIcon from '@mui/icons-material/Add';
import useServerList from '../../hooks/useServerList';
import useToast from '../../hooks/useToast';
import { suggestionsApi, departmentsApi } from '../../services/domains';
import DataTable from '../../components/common/DataTable';
import FilterBar from '../../components/common/FilterBar';
import StatusBadge from '../../components/common/StatusBadge';
import { SUGGESTION_STATUS_OPTIONS } from '../../constants/options';
import SuggestionFormDialog from './SuggestionFormDialog';

export default function SuggestionsListPage() {
  const navigate = useNavigate();
  const { showSuccess } = useToast();
  // A Dashboard stat tile (e.g. "Pending Reviews") links here with ?status=... — read once at
  // mount.
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status');
  const list = useServerList(suggestionsApi.list, {
    initialFilters: initialStatus ? { status: initialStatus } : undefined,
  });
  const [formOpen, setFormOpen] = useState(false);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    departmentsApi.list({ limit: 100 }).then((res) => setDepartments(res.data)).catch(() => setDepartments([]));
  }, []);

  const columns = [
    { key: 'title', label: 'Title', sortable: true },
    { key: 'application', label: 'Application', render: (r) => r.application?.name || '—' },
    { key: 'department', label: 'Department', render: (r) => r.department?.name || '—' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
  ];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Application Improvement Suggestions</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>New Suggestion</Button>
      </Stack>

      <FilterBar
        search={list.search}
        onSearchChange={list.setSearch}
        filters={list.filters}
        onFiltersChange={list.setFilters}
        filterDefs={[
          { key: 'departmentId', label: 'Department', options: departments.map((d) => ({ value: d.id, label: d.name })) },
          { key: 'status', label: 'Status', options: SUGGESTION_STATUS_OPTIONS },
        ]}
        searchPlaceholder="Search suggestions..."
      />

      <DataTable
        columns={columns}
        rows={list.rows}
        pagination={list.pagination}
        sort={list.sort}
        onSortChange={list.setSort}
        onPageChange={list.setPage}
        onRowsPerPageChange={list.setLimit}
        onRowClick={(row) => navigate(`/suggestions/${row.id}`)}
        loading={list.loading}
        emptyMessage="No improvement suggestions filed yet"
      />

      <SuggestionFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={(suggestion) => { setFormOpen(false); showSuccess('Suggestion submitted'); navigate(`/suggestions/${suggestion.id}`); }}
      />
    </Box>
  );
}

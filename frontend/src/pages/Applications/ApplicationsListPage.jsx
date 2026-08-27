import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import AddIcon from '@mui/icons-material/Add';
import useServerList from '../../hooks/useServerList';
import useToast from '../../hooks/useToast';
import { applicationsApi, departmentsApi } from '../../services/domains';
import DataTable from '../../components/common/DataTable';
import FilterBar from '../../components/common/FilterBar';
import StatusBadge from '../../components/common/StatusBadge';
import usePermission from '../../routes/usePermission';
import ApplicationFormDialog from './ApplicationFormDialog';
import { APPLICATION_STATUS_OPTIONS, INDUSTRY_OPTIONS, FUNCTIONAL_AREA_OPTIONS } from '../../constants/options';
import humanize from '../../utils/humanize';

export default function ApplicationsListPage() {
  const navigate = useNavigate();
  const canCreate = usePermission('applications', 'create');
  const [formOpen, setFormOpen] = useState(false);
  const [departments, setDepartments] = useState([]);
  const { showSuccess } = useToast();
  const list = useServerList(applicationsApi.list);

  useEffect(() => {
    departmentsApi.list({ limit: 100 }).then((res) => setDepartments(res.data)).catch(() => setDepartments([]));
  }, []);

  const columns = [
    { key: 'name', label: 'Project Name', sortable: true },
    { key: 'department', label: 'Department', render: (row) => row.department?.name || '—' },
    { key: 'owner', label: 'Owner', render: (row) => row.owner?.name || '—' },
    { key: 'industry', label: 'Industry', render: (row) => (row.industry ? humanize(row.industry) : '—') },
    { key: 'functionalArea', label: 'Functional Area', render: (row) => (row.functionalArea ? humanize(row.functionalArea) : '—') },
    { key: 'status', label: 'Status', sortable: true, render: (row) => <StatusBadge value={row.status} /> },
  ];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Applications</Typography>
        {canCreate && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>New Application</Button>
        )}
      </Stack>

      <FilterBar
        search={list.search}
        onSearchChange={list.setSearch}
        filters={list.filters}
        onFiltersChange={list.setFilters}
        filterDefs={[
          { key: 'status', label: 'Status', options: APPLICATION_STATUS_OPTIONS },
          { key: 'departmentId', label: 'Department', options: departments.map((d) => ({ value: d.id, label: d.name })) },
          { key: 'industry', label: 'Industry', options: INDUSTRY_OPTIONS },
          { key: 'functionalArea', label: 'Functional Area', options: FUNCTIONAL_AREA_OPTIONS },
        ]}
        searchPlaceholder="Search applications..."
      />

      <DataTable
        columns={columns}
        rows={list.rows}
        pagination={list.pagination}
        sort={list.sort}
        onSortChange={list.setSort}
        onPageChange={list.setPage}
        onRowsPerPageChange={list.setLimit}
        onRowClick={(row) => navigate(`/applications/${row.id}`)}
        loading={list.loading}
        emptyMessage="No applications yet — create the first one to get started."
      />

      <ApplicationFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); showSuccess('Application created'); list.reload(); }}
      />
    </Box>
  );
}

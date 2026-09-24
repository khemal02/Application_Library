import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import useServerList from '../../hooks/useServerList';
import { applicationsApi, departmentsApi } from '../../services/domains';
import DataTable from '../../components/common/DataTable';
import FilterBar from '../../components/common/FilterBar';
import StatusBadge from '../../components/common/StatusBadge';
import usePageMeta from '../../hooks/usePageMeta';
import { APPLICATION_STATUS_OPTIONS, INDUSTRY_OPTIONS, FUNCTIONAL_AREA_OPTIONS, applicationStatusLabel } from '../../constants/options';
import humanize from '../../utils/humanize';

export default function ApplicationsListPage() {
  const navigate = useNavigate();
  usePageMeta('Applications', 'Every live and in-progress application.');
  const [departments, setDepartments] = useState([]);
  // A Dashboard stat tile (e.g. "Applications In Progress", "My Applications") links here with
  // ?status=... / ?ownerId=... — read once at mount, same convention every list page linked from
  // a dashboard tile follows.
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status');
  const initialOwnerId = searchParams.get('ownerId');
  const initialFilters = {
    ...(initialStatus ? { status: initialStatus } : {}),
    ...(initialOwnerId ? { ownerId: initialOwnerId } : {}),
  };
  const list = useServerList(applicationsApi.list, {
    initialFilters: Object.keys(initialFilters).length > 0 ? initialFilters : undefined,
  });

  useEffect(() => {
    departmentsApi.list({ limit: 100 }).then((res) => setDepartments(res.data)).catch(() => setDepartments([]));
  }, []);

  const columns = [
    { key: 'name', label: 'Project Name', sortable: true },
    { key: 'owner', label: 'Owner', render: (row) => row.owner?.name || '—' },
    { key: 'department', label: 'Department', render: (row) => row.department?.name || '—' },
    { key: 'industry', label: 'Industry', render: (row) => (row.industry ? humanize(row.industry) : '—') },
    { key: 'functionalArea', label: 'Functional Area', render: (row) => (row.functionalArea ? humanize(row.functionalArea) : '—') },
    { key: 'status', label: 'Status', sortable: true, render: (row) => <StatusBadge value={row.status} label={applicationStatusLabel(row.status)} /> },
  ];

  return (
    <Box>
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
        searchPlaceholder="Search here..."
      />

      {list.pagination && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {list.rows.length} of {list.pagination.totalItems} application{list.pagination.totalItems === 1 ? '' : 's'}
        </Typography>
      )}

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
        emptyMessage="No applications yet."
      />
    </Box>
  );
}

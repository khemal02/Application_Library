import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Badge from '@mui/material/Badge';
import Popover from '@mui/material/Popover';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import useServerList from '../../hooks/useServerList';
import { applicationsApi, departmentsApi } from '../../services/domains';
import DataTable from '../../components/common/DataTable';
import FilterPopoverField from '../../components/common/FilterPopoverField';
import StatusBadge from '../../components/common/StatusBadge';
import usePageMeta from '../../hooks/usePageMeta';
import { APPLICATION_STATUS_OPTIONS, INDUSTRY_OPTIONS, FUNCTIONAL_AREA_OPTIONS, applicationStatusLabel } from '../../constants/options';
import humanize from '../../utils/humanize';
import initials from '../../utils/initials';

// Same key set as the four dropdowns below — used both to count how many are active (for the
// Filters button's badge) and to clear them all at once, mirroring the Ideas module's own toolbar.
const FILTER_PANEL_KEYS = ['status', 'departmentId', 'industry', 'functionalArea'];

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
  const [filtersAnchor, setFiltersAnchor] = useState(null);

  useEffect(() => {
    departmentsApi.list({ limit: 100 }).then((res) => setDepartments(res.data)).catch(() => setDepartments([]));
  }, []);

  // Mirrors the Ideas module's own toolbar exactly — same "'' or undefined deletes the key" rule.
  const handleFilterChange = (key, value) => {
    const next = { ...list.filters };
    if (value === '' || value === undefined) delete next[key];
    else next[key] = value;
    list.setFilters(next);
  };
  const activeFilterCount = FILTER_PANEL_KEYS.filter((k) => list.filters[k]).length;
  const clearAllFilters = () => {
    const next = { ...list.filters };
    FILTER_PANEL_KEYS.forEach((k) => delete next[k]);
    list.setFilters(next);
  };

  const columns = [
    { key: 'name', label: 'Project Name', sortable: true },
    {
      key: 'owner',
      label: 'Owner',
      // Same avatar + name treatment as the Ideas module's own "Submitted By" column.
      render: (row) => (
        <Stack direction="row" spacing={1} alignItems="center">
          <Avatar sx={{ width: 24, height: 24, fontSize: '10.5px', fontWeight: 800, bgcolor: '#EAF2FE', color: '#1D4ED8' }}>
            {initials(row.owner?.name)}
          </Avatar>
          <Typography variant="body2">{row.owner?.name || '—'}</Typography>
        </Stack>
      ),
    },
    { key: 'department', label: 'Department', render: (row) => row.department?.name || '—' },
    { key: 'industry', label: 'Industry', render: (row) => (row.industry ? humanize(row.industry) : '—') },
    { key: 'functionalArea', label: 'Functional Area', render: (row) => (row.functionalArea ? humanize(row.functionalArea) : '—') },
    { key: 'status', label: 'Status', sortable: true, render: (row) => <StatusBadge value={row.status} label={applicationStatusLabel(row.status)} /> },
  ];

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems={{ sm: 'center' }} flexWrap="wrap" useFlexGap rowGap={2} sx={{ mb: 2.5 }}>
        <TextField
          size="small"
          placeholder="Search here..."
          value={list.search}
          onChange={(e) => list.setSearch(e.target.value)}
          sx={{
            width: 220, flexShrink: 0,
            '& .MuiInputBase-input': { fontSize: '13px', textOverflow: 'ellipsis' },
          }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />

        <Badge badgeContent={activeFilterCount} color="primary" invisible={activeFilterCount === 0}>
          <Button
            variant="outlined" size="small" color="inherit"
            startIcon={<FilterListIcon fontSize="small" />}
            onClick={(e) => setFiltersAnchor(e.currentTarget)}
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
            <FilterPopoverField
              label="Status" allLabel="All statuses"
              value={list.filters.status} onChange={(v) => handleFilterChange('status', v)}
              options={APPLICATION_STATUS_OPTIONS}
            />
            <FilterPopoverField
              label="Department" allLabel="All departments"
              value={list.filters.departmentId} onChange={(v) => handleFilterChange('departmentId', v)}
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
            />
            <FilterPopoverField
              label="Industry" allLabel="All industries"
              value={list.filters.industry} onChange={(v) => handleFilterChange('industry', v)}
              options={INDUSTRY_OPTIONS}
            />
            <FilterPopoverField
              label="Functional Area" allLabel="All functional areas"
              value={list.filters.functionalArea} onChange={(v) => handleFilterChange('functionalArea', v)}
              options={FUNCTIONAL_AREA_OPTIONS}
            />
          </Stack>
          <Divider sx={{ my: 2 }} />
          <Stack direction="row" justifyContent="space-between">
            <Button size="small" onClick={clearAllFilters} disabled={activeFilterCount === 0}>Clear all</Button>
            <Button size="small" variant="contained" onClick={() => setFiltersAnchor(null)}>Done</Button>
          </Stack>
        </Box>
      </Popover>

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

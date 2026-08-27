import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import dayjs from 'dayjs';
import useServerList from '../../hooks/useServerList';
import { auditLogsApi } from '../../services/domains';
import DataTable from '../../components/common/DataTable';
import FilterBar from '../../components/common/FilterBar';
import { getAuditEntityName } from '../../utils/auditEntityName';

const ACTION_COLOR = { create: 'success', update: 'info', delete: 'error' };

export default function AuditLogsPage() {
  const list = useServerList(auditLogsApi.list, { initialSort: { field: 'createdAt', direction: 'desc' } });

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>Audit Logs</Typography>

      <FilterBar
        search={list.search} onSearchChange={list.setSearch}
        filters={list.filters} onFiltersChange={list.setFilters}
        filterDefs={[
          { key: 'action', label: 'Action', options: [{ value: 'create', label: 'Create' }, { value: 'update', label: 'Update' }, { value: 'delete', label: 'Delete' }] },
        ]}
        searchPlaceholder="Filter by entity type or id..."
      />

      <DataTable
        columns={[
          { key: 'createdAt', label: 'When', render: (r) => dayjs(r.createdAt).format('MMM D, YYYY HH:mm') },
          { key: 'user', label: 'User', render: (r) => r.user?.name || 'System' },
          { key: 'role', label: 'Role', render: (r) => (r.user?.role?.label ? <Chip size="small" variant="outlined" label={r.user.role.label} /> : '—') },
          { key: 'action', label: 'Action', render: (r) => <Chip size="small" color={ACTION_COLOR[r.action] || 'default'} label={r.action} /> },
          { key: 'entityType', label: 'Entity Type', render: (r) => r.entityType.replace(/_/g, ' ') },
          { key: 'entityName', label: 'Entity Name', render: (r) => getAuditEntityName(r) || `${r.entityId.slice(0, 8)}…` },
        ]}
        rows={list.rows}
        pagination={list.pagination}
        onPageChange={list.setPage}
        onRowsPerPageChange={list.setLimit}
        loading={list.loading}
      />
    </Box>
  );
}

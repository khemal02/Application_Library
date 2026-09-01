import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import AddIcon from '@mui/icons-material/Add';
import useServerList from '../../hooks/useServerList';
import useToast from '../../hooks/useToast';
import { featureRequestsApi, departmentsApi } from '../../services/domains';
import DataTable from '../../components/common/DataTable';
import FilterBar from '../../components/common/FilterBar';
import StatusBadge from '../../components/common/StatusBadge';
import { IDEA_STATUS_OPTIONS, INDUSTRY_OPTIONS, FUNCTIONAL_AREA_OPTIONS, ideaStatusLabel } from '../../constants/options';
import humanize from '../../utils/humanize';
import FeatureRequestFormDialog from './FeatureRequestFormDialog';

/**
 * Forked from IdeasListPage.jsx — see the Ideas/Feature-Requests split. "Modify Current
 * Application" now has its own table/module/RBAC resource ('feature_requests') entirely — this
 * no longer shares a backend table or submit form with New Ideas, just the display shape (status
 * labels/options are reused from constants/options.js since Ideas' and FeatureRequests' live
 * status sets are identical: under_review/approved/rejected).
 */
export default function FeatureRequestsListPage() {
  const navigate = useNavigate();
  const { showSuccess } = useToast();
  const list = useServerList(featureRequestsApi.list, {
    initialSort: { field: 'requestNumber', direction: 'desc' },
  });
  const [formOpen, setFormOpen] = useState(false);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    departmentsApi.list({ limit: 100 }).then((res) => setDepartments(res.data)).catch(() => setDepartments([]));
  }, []);

  const columns = [
    { key: 'title', label: 'Title', sortable: true },
    { key: 'application', label: 'Application', render: (r) => r.application?.name || '—' },
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
        <Typography variant="h5" fontWeight={700}>Modify Current Application</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>Submit Feature Request</Button>
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
        searchPlaceholder="Search feature requests..."
        right={(
          <Stack direction="row" spacing={1} alignItems="center">
            {/* Any active user can be a panel reviewer or approver now (see
                featureRequests.service.js#addParticipants) — not gated to a specific permission
                the way the old team_lead/manager/ceo chain was. */}
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
        onRowClick={(row) => navigate(`/feature-requests/${row.id}`)}
        loading={list.loading}
        emptyMessage="No feature requests submitted yet — be the first!"
      />

      <FeatureRequestFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={(featureRequest) => { setFormOpen(false); showSuccess('Feature request submitted'); navigate(`/feature-requests/${featureRequest.id}`); }}
      />
    </Box>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import useServerList from '../../../hooks/useServerList';
import useToast from '../../../hooks/useToast';
import { suggestionsApi } from '../../../services/domains';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import SuggestionFormDialog from '../../Suggestions/SuggestionFormDialog';

export default function SuggestionsTab({ applicationId, applicationName }) {
  const navigate = useNavigate();
  const { showSuccess } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const list = useServerList((params) => suggestionsApi.list({ ...params, applicationId }), { limit: 50 });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700}>Improvement Suggestions</Typography>
        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>
          New Suggestion
        </Button>
      </Stack>
      <DataTable
        columns={[
          { key: 'title', label: 'Title' },
          { key: 'department', label: 'Department', render: (r) => r.department?.name || '—' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
          { key: 'submitter', label: 'Submitted By', render: (r) => r.submitter?.name || '—' },
        ]}
        rows={list.rows}
        pagination={list.pagination}
        onPageChange={list.setPage}
        onRowsPerPageChange={list.setLimit}
        onRowClick={(row) => navigate(`/suggestions/${row.id}`)}
        loading={list.loading}
        emptyMessage="No suggestions filed against this application yet"
      />

      <SuggestionFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        applicationId={applicationId}
        applicationName={applicationName}
        onCreated={(suggestion) => { setFormOpen(false); showSuccess('Suggestion submitted'); navigate(`/suggestions/${suggestion.id}`); }}
      />
    </Box>
  );
}

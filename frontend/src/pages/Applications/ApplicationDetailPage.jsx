import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import EditIcon from '@mui/icons-material/EditOutlined';
import { applicationsApi } from '../../services/domains';
import useResource from '../../hooks/useResource';
import useBreadcrumbLabel from '../../hooks/useBreadcrumbLabel';
import useToast from '../../hooks/useToast';
import { LoadingBlock, ErrorBlock } from '../../components/common/AsyncState';
import StatusBadge from '../../components/common/StatusBadge';
import usePermission from '../../routes/usePermission';
import ApplicationFormDialog from './ApplicationFormDialog';
import KnownIssuesTab from './tabs/KnownIssuesTab';
import BugsTab from './tabs/BugsTab';
import BackButton from '../../components/common/BackButton';

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const [editOpen, setEditOpen] = useState(false);
  const canUpdate = usePermission('applications', 'update');
  const { showSuccess } = useToast();

  const { data: application, loading, error, reload } = useResource(() => applicationsApi.getById(id), [id]);
  useBreadcrumbLabel(application?.name);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!application) return null;

  return (
    <Box>
      <BackButton />
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{application.name}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720 }}>{application.description}</Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <StatusBadge value={application.status} />
            <StatusBadge value={application.priority} />
            {application.currentVersion && <Chip size="small" label={`v${application.currentVersion}`} variant="outlined" />}
          </Stack>
        </Box>
        {canUpdate && (
          <Button startIcon={<EditIcon />} variant="outlined" onClick={() => setEditOpen(true)}>Edit</Button>
        )}
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
        <KnownIssuesTab applicationId={id} />
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
        <BugsTab applicationId={id} />
      </Paper>

      <ApplicationFormDialog
        open={editOpen}
        application={application}
        onClose={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); showSuccess('Application updated'); reload(); }}
      />
    </Box>
  );
}

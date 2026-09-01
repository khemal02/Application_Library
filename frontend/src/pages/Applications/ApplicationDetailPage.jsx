import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import EditIcon from '@mui/icons-material/EditOutlined';
import { applicationsApi } from '../../services/domains';
import useResource from '../../hooks/useResource';
import useBreadcrumbLabel from '../../hooks/useBreadcrumbLabel';
import useToast from '../../hooks/useToast';
import { LoadingBlock, ErrorBlock } from '../../components/common/AsyncState';
import usePermission from '../../routes/usePermission';
import ApplicationFormDialog from './ApplicationFormDialog';
import ProjectInfoBox from './ProjectInfoBox';
import ChangeRequestsTab from './tabs/ChangeRequestsTab';
import IssuesCard from './IssuesCard';
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
      {canUpdate && (
        <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
          <Button startIcon={<EditIcon />} variant="outlined" onClick={() => setEditOpen(true)}>Edit</Button>
        </Stack>
      )}

      <ProjectInfoBox application={application} />

      {/* Plain Box, not Paper — this section shouldn't read as its own bordered/shadowed card;
          the row-list inside (ChangeRequestsCard.jsx) already has its own bordered box. */}
      <Box sx={{ p: 2, mt: 2 }}>
        <ChangeRequestsTab applicationId={id} />
      </Box>

      {/* Plain Box, same reasoning as the Change Requests wrapper above — IssuesCard.jsx already
          has its own bordered rows and shouldn't be wrapped in a second bordered/shadowed shell. */}
      <Box sx={{ p: 2, mt: 2 }}>
        <IssuesCard applicationId={id} applicationOwnerId={application.ownerId} />
      </Box>

      <ApplicationFormDialog
        open={editOpen}
        application={application}
        onClose={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); showSuccess('Application updated'); reload(); }}
      />
    </Box>
  );
}

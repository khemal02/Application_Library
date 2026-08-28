import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
import KnownIssuesTab from './tabs/KnownIssuesTab';
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

      <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
        <ChangeRequestsTab applicationId={id} />
      </Paper>

      <Accordion variant="outlined" sx={{ mt: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>Issues</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <KnownIssuesTab applicationId={id} />
        </AccordionDetails>
      </Accordion>

      <ApplicationFormDialog
        open={editOpen}
        application={application}
        onClose={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); showSuccess('Application updated'); reload(); }}
      />
    </Box>
  );
}

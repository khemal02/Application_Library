import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { applicationsApi } from '../../services/domains';
import useResource from '../../hooks/useResource';
import useBreadcrumbLabel from '../../hooks/useBreadcrumbLabel';
import { LoadingBlock, ErrorBlock } from '../../components/common/AsyncState';
import ProjectInfoBox from './ProjectInfoBox';
import ChangeRequestsTab from './tabs/ChangeRequestsTab';
import IssuesCard from './IssuesCard';
import BackButton from '../../components/common/BackButton';

export default function ApplicationDetailPage() {
  const { id } = useParams();

  const { data: application, loading, error, reload } = useResource(() => applicationsApi.getById(id), [id]);
  useBreadcrumbLabel(application?.name);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!application) return null;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1}>
        <BackButton />
        <Typography variant="body2" color="text.secondary">
          Owner by, <Typography component="span" variant="body2" fontWeight={700} color="text.primary">{application.owner?.name || '—'}</Typography>
        </Typography>
      </Stack>

      <ProjectInfoBox application={application} />

      <ChangeRequestsTab applicationId={id} />

      {/* Plain Box, same reasoning as the Change Requests wrapper above — IssuesCard.jsx already
          has its own bordered rows and shouldn't be wrapped in a second bordered/shadowed shell. */}
      <Box sx={{ p: 2, mt: 2 }}>
        <IssuesCard applicationId={id} applicationOwnerId={application.ownerId} />
      </Box>
    </Box>
  );
}

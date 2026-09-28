import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { applicationsApi } from '../../services/domains';
import useResource from '../../hooks/useResource';
import usePageMeta from '../../hooks/usePageMeta';
import { LoadingBlock, ErrorBlock } from '../../components/common/AsyncState';
import ProjectInfoBox from './ProjectInfoBox';
import ChangeRequestsTab from './tabs/ChangeRequestsTab';
import IssuesCard from './IssuesCard';
import BackButton from '../../components/common/BackButton';

export default function ApplicationDetailPage() {
  const { id } = useParams();
  // Same title/subtitle as the Applications list page — the topbar shouldn't go blank just
  // because the viewer navigated from the list into one specific application.
  usePageMeta('Applications', 'Every live and in-progress application.');

  const { data: application, loading, error, reload } = useResource(() => applicationsApi.getById(id), [id]);

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
      <Typography fontWeight={800} sx={{ fontSize: '24px', mb: 2, mt: 1 }}>{application.name}</Typography>

      <ProjectInfoBox application={application} />

      <ChangeRequestsTab applicationId={id} />

      {/* IssuesCard.jsx now renders its own bordered card (matching ChangeRequestsCard.jsx's own
          chrome exactly), so it just needs the same top margin as that gives itself — no extra
          wrapper. */}
      <Box sx={{ mt: 2 }}>
        <IssuesCard applicationId={id} applicationOwnerId={application.ownerId} />
      </Box>
    </Box>
  );
}

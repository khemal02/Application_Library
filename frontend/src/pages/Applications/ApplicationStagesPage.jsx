import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { applicationsApi } from '../../services/domains';
import useResource from '../../hooks/useResource';
import useBreadcrumbLabel from '../../hooks/useBreadcrumbLabel';
import { LoadingBlock, ErrorBlock } from '../../components/common/AsyncState';
import BackButton from '../../components/common/BackButton';

const STAGES = ['Development', 'Testing', 'Deployment'];

export default function ApplicationStagesPage() {
  const { id } = useParams();
  const { data: application, loading, error, reload } = useResource(() => applicationsApi.getById(id), [id]);
  useBreadcrumbLabel(application?.name);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!application) return null;

  return (
    <Box>
      <BackButton />
      <Typography variant="h5" fontWeight={700} sx={{ mb: application.description ? 1 : 2 }}>{application.name}</Typography>
      {application.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
          {application.description}
        </Typography>
      )}

      <Stack spacing={2}>
        {STAGES.map((stage) => (
          <Paper key={stage} variant="outlined" sx={{ p: 2, minHeight: 120 }}>
            <Typography variant="subtitle1" fontWeight={700}>{stage}</Typography>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}

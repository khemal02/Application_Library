import { useNavigate, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import BackButton from '../../components/common/BackButton';
import { LoadingBlock, ErrorBlock } from '../../components/common/AsyncState';
import StatusBadge from '../../components/common/StatusBadge';
import { changeRequestsApi } from '../../services/domains';
import useResource from '../../hooks/useResource';
import useBreadcrumbLabel from '../../hooks/useBreadcrumbLabel';

const STAGE_LABELS = { development: 'Development', testing: 'Testing', deployment: 'Deployment' };
const STAGE_STATUS_META = {
  not_started: { color: 'default', label: 'Not started' },
  in_progress: { color: 'info', label: 'In progress' },
};

/**
 * Lands the Dashboard's "My Development"/"My Testing"/"My Deployment" tiles — see
 * changeRequests.service.js#myAssignedStages. Exists because, unlike Ideas/Feature Requests,
 * change requests have no list page of their own to filter into (they only ever live inside one
 * application's page) — a person assigned across several applications at once has nowhere else
 * this list could point to.
 */
export default function MyAssignedStagesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const stage = ['development', 'testing', 'deployment'].includes(searchParams.get('stage'))
    ? searchParams.get('stage')
    : 'development';
  const stageLabel = STAGE_LABELS[stage];

  const { data, loading, error, reload } = useResource(() => changeRequestsApi.myAssignedStages(stage), [stage]);
  useBreadcrumbLabel(`My ${stageLabel}`);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;

  const rows = data || [];

  return (
    <Box>
      <BackButton />
      <Typography variant="h5" fontWeight={700} sx={{ mt: 1, mb: 0.5 }}>My {stageLabel}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Change requests where {stageLabel} is assigned to you and still needs your action.
      </Typography>

      {rows.length === 0 ? (
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 4, textAlign: 'center' }}>
          <Typography variant="body2" fontWeight={600}>Nothing waiting on you</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            No {stageLabel.toLowerCase()} stages are currently assigned to you.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {rows.map((row) => (
            <Box
              key={row.stageId}
              onClick={() => navigate(row.url)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(row.url); } }}
              sx={{
                py: 1.5, px: 1.5, cursor: 'pointer',
                border: 1, borderColor: 'divider', borderRadius: 1,
                '&:hover': { bgcolor: 'action.hover' },
                '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '-2px' },
              }}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>{row.title}</Typography>
                  <Typography variant="caption" color="text.secondary">{row.applicationName}</Typography>
                </Box>
                <StatusBadge color={STAGE_STATUS_META[row.status]?.color} label={STAGE_STATUS_META[row.status]?.label} />
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}

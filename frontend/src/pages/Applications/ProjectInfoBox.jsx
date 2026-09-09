import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import dayjs from 'dayjs';
import humanize from '../../utils/humanize';
import { applicationStatusLabel } from '../../constants/options';
import StatusBadge from '../../components/common/StatusBadge';

function InfoField({ label, value, fullWidth }) {
  return (
    <Grid item xs={fullWidth ? 12 : 6} sm={fullWidth ? 12 : 4} md={fullWidth ? 12 : 3}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{label}</Typography>
      {typeof value === 'string' ? (
        <Typography variant="body2" sx={{ mt: 0.25, whiteSpace: 'pre-wrap' }}>{value}</Typography>
      ) : (
        <Box sx={{ mt: 0.25 }}>{value}</Box>
      )}
    </Grid>
  );
}

const formatDate = (value) => (value ? dayjs(value).format('MMM D, YYYY') : '—');

export default function ProjectInfoBox({ application }) {
  const navigate = useNavigate();
  const openStages = () => navigate(`/applications/${application.id}/stages`);

  return (
    <Paper
      variant="outlined"
      onClick={openStages}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openStages(); }
      }}
      sx={{
        p: 2, mt: 2, cursor: 'pointer',
        '&:hover': { bgcolor: 'action.hover' },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '-2px' },
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap rowGap={1} sx={{ mb: 3 }}>
        <Typography variant="h6" fontWeight={700} color="text.primary">
          {application.name}
        </Typography>
        {/* Just the current status, not the whole Development -> Testing -> Live journey — by the
            time an app is registered here (almost always via Application Tracking's go-live step),
            it's already live; showing the full stepper implied it was still mid-rollout. */}
        <StatusBadge value={application.status} label={applicationStatusLabel(application.status)} />
      </Stack>

      {application.description && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mb: 2,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {application.description}
        </Typography>
      )}

      <Grid container spacing={2}>
        <InfoField label="Department" value={application.department?.name || '—'} />
        <InfoField label="Owner" value={application.owner?.name || '—'} />
        <InfoField label="Industry" value={application.industry ? humanize(application.industry) : '—'} />
        <InfoField label="Functional Area" value={application.functionalArea ? humanize(application.functionalArea) : '—'} />
        <InfoField label="Current Version" value={application.currentVersion || '—'} />
        <InfoField label="Start Date" value={formatDate(application.startDate)} />
        <InfoField label="Release Date" value={formatDate(application.releaseDate)} />
        {application.repositoryUrl && (
          <InfoField label="Repository" value={<Link href={application.repositoryUrl} target="_blank" rel="noopener noreferrer" variant="body2" onClick={(e) => e.stopPropagation()}>{application.repositoryUrl}</Link>} />
        )}
        {application.deploymentUrl && (
          <InfoField label="Deployment" value={<Link href={application.deploymentUrl} target="_blank" rel="noopener noreferrer" variant="body2" onClick={(e) => e.stopPropagation()}>{application.deploymentUrl}</Link>} />
        )}
      </Grid>
    </Paper>
  );
}

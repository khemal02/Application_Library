import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
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
        // Bold, not the default body2 weight — matches the approved reference's own field values.
        <Typography variant="body2" fontWeight={700} sx={{ mt: 0.25, whiteSpace: 'pre-wrap' }}>{value}</Typography>
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
        p: 2, mt: 2, cursor: 'pointer', position: 'relative',
        '&:hover': { bgcolor: 'action.hover' },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '-2px' },
      }}
    >
      {/* Just the current status, not the whole Development -> Testing -> Live journey — by the
          time an app is registered here (almost always via Application Tracking's go-live step),
          it's already live; showing the full stepper implied it was still mid-rollout. The
          application's name itself is now the page's own title above (ApplicationDetailPage), not
          repeated here. Absolutely positioned, not its own row above the grid — sits inline with
          the field labels' own line instead of pushing them down, matching the approved reference. */}
      <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
        <StatusBadge value={application.status} label={applicationStatusLabel(application.status)} />
      </Box>

      <Grid container spacing={2}>
        <InfoField label="Department" value={application.department?.name || '—'} />
        <InfoField label="Owner" value={application.owner?.name || '—'} />
        <InfoField label="Industry" value={application.industry ? humanize(application.industry) : '—'} />
        <InfoField label="Functional Area" value={application.functionalArea ? humanize(application.functionalArea) : '—'} />
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

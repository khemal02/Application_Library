import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import dayjs from 'dayjs';
import StatusBadge from '../../components/common/StatusBadge';
import humanize from '../../utils/humanize';

const STATUS_FLOW = ['development', 'testing', 'deployment'];
// Same semantics as StatusBadge's COLOR_MAP for these three values — kept local since only the
// active stage needs a resolved theme color here, everything before/after it just reads as muted.
const STAGE_COLOR = { development: 'default', testing: 'info', deployment: 'success' };

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
  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap rowGap={1} sx={{ mb: 3 }}>
        <Typography
          component={RouterLink}
          to={`/applications/${application.id}/stages`}
          variant="h6"
          fontWeight={700}
          color="text.primary"
          sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
        >
          {application.name}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          {STATUS_FLOW.map((stage, i) => (
            <Stack key={stage} direction="row" spacing={1} alignItems="center">
              <Chip
                size="small"
                label={humanize(stage)}
                color={stage === application.status ? STAGE_COLOR[stage] : 'default'}
                variant={stage === application.status ? 'filled' : 'outlined'}
                sx={stage === application.status ? { fontWeight: 700 } : undefined}
              />
              {i < STATUS_FLOW.length - 1 && <ArrowForwardIcon fontSize="small" color="disabled" />}
            </Stack>
          ))}
        </Stack>
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
        <InfoField label="Priority" value={<StatusBadge value={application.priority} />} />
        <InfoField label="Current Version" value={application.currentVersion || '—'} />
        <InfoField label="Start Date" value={formatDate(application.startDate)} />
        <InfoField label="Release Date" value={formatDate(application.releaseDate)} />
        {application.repositoryUrl && (
          <InfoField label="Repository" value={<Link href={application.repositoryUrl} target="_blank" rel="noopener noreferrer" variant="body2">{application.repositoryUrl}</Link>} />
        )}
        {application.deploymentUrl && (
          <InfoField label="Deployment" value={<Link href={application.deploymentUrl} target="_blank" rel="noopener noreferrer" variant="body2">{application.deploymentUrl}</Link>} />
        )}
      </Grid>
    </Paper>
  );
}

import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Link from '@mui/material/Link';

export default function OverviewTab({ application }) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Details</Typography>
          <Stack spacing={1}>
            <Typography variant="body2"><strong>Department:</strong> {application.department?.name || '—'}</Typography>
            <Typography variant="body2"><strong>Start Date:</strong> {application.startDate || '—'}</Typography>
            <Typography variant="body2"><strong>Release Date:</strong> {application.releaseDate || '—'}</Typography>
            <Typography variant="body2">
              <strong>Repository:</strong> {application.repositoryUrl ? <Link href={application.repositoryUrl} target="_blank" rel="noreferrer">{application.repositoryUrl}</Link> : '—'}
            </Typography>
            <Typography variant="body2">
              <strong>Deployment:</strong> {application.deploymentUrl ? <Link href={application.deploymentUrl} target="_blank" rel="noreferrer">{application.deploymentUrl}</Link> : '—'}
            </Typography>
          </Stack>
        </Paper>
      </Grid>
    </Grid>
  );
}

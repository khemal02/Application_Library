import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import dayjs from 'dayjs';
import { profileApi } from '../../../services/domains';
import useResource from '../../../hooks/useResource';
import { ErrorBlock } from '../../../components/common/AsyncState';
import StatusBadge from '../../../components/common/StatusBadge';
import humanize from '../../../utils/humanize';
import SectionCard from './SectionCard';

function ReadField({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value || '—'}</Typography>
    </Box>
  );
}

export default function AccountSection() {
  const { data: account, loading, error, reload } = useResource(() => profileApi.getAccount());

  if (loading) {
    return (
      <SectionCard title="Account">
        <Grid container spacing={2.5}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Grid item xs={12} sm={6} key={i}><Skeleton width="50%" /><Skeleton width="80%" height={28} /></Grid>
          ))}
        </Grid>
        <Skeleton width="30%" sx={{ mt: 3 }} />
        <Skeleton variant="rounded" height={80} sx={{ mt: 1 }} />
      </SectionCard>
    );
  }
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!account) return null;

  const byResource = account.permissions.reduce((acc, p) => {
    (acc[p.resource] ||= []).push(p.action);
    return acc;
  }, {});

  return (
    <SectionCard title="Account">
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}><ReadField label="Username" value={account.username} /></Grid>
        <Grid item xs={12} sm={6}><ReadField label="Login Email" value={account.loginEmail} /></Grid>
        <Grid item xs={12} sm={6}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Account Status</Typography>
          <StatusBadge value={account.accountStatus} />
        </Grid>
        <Grid item xs={12} sm={6}><ReadField label="User Role" value={account.role} /></Grid>
        <Grid item xs={12} sm={6}>
          <ReadField label="Account Created Date" value={dayjs(account.accountCreatedDate).format('MMM D, YYYY')} />
        </Grid>
      </Grid>

      <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Assigned Permissions</Typography>
      {Object.keys(byResource).length === 0 ? (
        <Typography variant="body2" color="text.secondary">No permissions assigned.</Typography>
      ) : (
        <Stack spacing={1.25}>
          {Object.entries(byResource).sort(([a], [b]) => a.localeCompare(b)).map(([resource, actions]) => (
            <Box key={resource} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="body2" sx={{ minWidth: 140, fontWeight: 600 }}>
                {resource === '*' ? 'Everything' : humanize(resource)}
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {actions.sort().map((action) => (
                  <Chip key={action} label={action} size="small" variant="outlined" sx={{ textTransform: 'capitalize' }} />
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </SectionCard>
  );
}

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import { profileApi } from '../../../services/domains';
import useResource from '../../../hooks/useResource';
import { ErrorBlock } from '../../../components/common/AsyncState';
import avatarColor from '../../../utils/avatarColor';
import { FUNCTIONAL_AREA_OPTIONS, INDUSTRY_OPTIONS } from '../../../constants/options';
import SectionCard from './SectionCard';

/** Plain read-only label/value pair. Every field here is admin-managed (see Admin > Users) — this
 * page only ever displays it, never edits it. */
function ReadField({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value || '—'}</Typography>
    </Box>
  );
}

function ProfileSkeleton() {
  return (
    <SectionCard title="Profile">
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <Skeleton variant="circular" width={72} height={72} />
        <Box sx={{ flex: 1 }}>
          <Skeleton width="40%" height={28} />
          <Skeleton width="25%" />
        </Box>
      </Stack>
      <Grid container spacing={2.5}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Grid item xs={12} sm={6} key={i}><Skeleton width="70%" /><Skeleton width="90%" height={28} /></Grid>
        ))}
      </Grid>
    </SectionCard>
  );
}

export default function ProfileSection() {
  const { data: profile, loading, error, reload } = useResource(() => profileApi.getMe());

  if (loading) return <ProfileSkeleton />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!profile) return null;

  const industryLabel = INDUSTRY_OPTIONS.find((o) => o.value === profile.industry)?.label;

  return (
    <SectionCard title="Profile">
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <Avatar sx={{ width: 72, height: 72, bgcolor: avatarColor(profile.id || profile.name), color: '#fff', fontSize: 28 }} src={profile.avatarUrl || undefined}>
          {profile.name?.[0]}
        </Avatar>
        <Box>
          <Typography variant="h6" fontWeight={700}>{profile.name}</Typography>
          <Typography variant="body2" color="text.secondary">{profile.role?.label}</Typography>
        </Box>
      </Stack>

      <Grid container spacing={2.5}>
        <Grid item xs={12} sm={6}><ReadField label="Email Address" value={profile.email} /></Grid>
        <Grid item xs={12} sm={6}><ReadField label="Department" value={profile.department?.name} /></Grid>
        <Grid item xs={12} sm={6}>
          {profile.functionalAreas?.length ? (
            <Box>
              <Typography variant="caption" color="text.secondary">Functional Area</Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                {profile.functionalAreas.map((fa) => (
                  <Chip key={fa} size="small" variant="outlined" label={FUNCTIONAL_AREA_OPTIONS.find((o) => o.value === fa)?.label || fa} />
                ))}
              </Stack>
            </Box>
          ) : <ReadField label="Functional Area" value={null} />}
        </Grid>
        <Grid item xs={12} sm={6}><ReadField label="Industry" value={industryLabel} /></Grid>
      </Grid>
    </SectionCard>
  );
}

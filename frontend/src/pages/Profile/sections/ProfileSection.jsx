import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import EditIcon from '@mui/icons-material/EditOutlined';
import dayjs from 'dayjs';
import { profileApi } from '../../../services/domains';
import useResource from '../../../hooks/useResource';
import useToast from '../../../hooks/useToast';
import { ErrorBlock } from '../../../components/common/AsyncState';
import { useAppDispatch } from '../../../app/hooks';
import { fetchMe } from '../../../features/auth/authSlice';
import avatarColor from '../../../utils/avatarColor';
import SectionCard from './SectionCard';

/** Plain read-only label/value pair — used for every field the brief marks read-only. */
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
        {Array.from({ length: 8 }).map((_, i) => (
          <Grid item xs={12} sm={6} key={i}><Skeleton width="70%" /><Skeleton width="90%" height={28} /></Grid>
        ))}
      </Grid>
    </SectionCard>
  );
}

export default function ProfileSection() {
  const dispatch = useAppDispatch();
  const { data: profile, loading, error, reload } = useResource(() => profileApi.getMe());
  const [editing, setEditing] = useState(false);
  const { showSuccess, showError } = useToast();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { phone: '', bio: '' },
  });

  useEffect(() => {
    if (profile) reset({ phone: profile.phone || '', bio: profile.bio || '' });
  }, [profile, reset]);

  if (loading) return <ProfileSkeleton />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!profile) return null;

  const onSave = async (values) => {
    try {
      await profileApi.updateMe(values);
      await reload();
      dispatch(fetchMe());
      setEditing(false);
      showSuccess('Profile updated successfully');
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to update profile');
    }
  };

  const onCancel = () => {
    reset({ phone: profile.phone || '', bio: profile.bio || '' });
    setEditing(false);
  };

  return (
    <SectionCard
      title="Profile"
      action={!editing && (
        <Button size="small" startIcon={<EditIcon />} onClick={() => setEditing(true)}>Edit</Button>
      )}
    >
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <Avatar sx={{ width: 72, height: 72, bgcolor: avatarColor(profile.id || profile.name), color: '#fff', fontSize: 28 }} src={profile.avatarUrl || undefined}>
          {profile.name?.[0]}
        </Avatar>
        <Box>
          <Typography variant="h6" fontWeight={700}>{profile.name}</Typography>
          <Typography variant="body2" color="text.secondary">{profile.designation || 'No designation set'}</Typography>
        </Box>
      </Stack>

      <Grid container spacing={2.5}>
        <Grid item xs={12} sm={6}><ReadField label="Employee ID" value={profile.employeeId} /></Grid>
        <Grid item xs={12} sm={6}><ReadField label="Email Address" value={profile.email} /></Grid>

        <Grid item xs={12} sm={6}>
          {editing ? (
            <TextField
              fullWidth size="small" label="Phone Number"
              {...register('phone', { required: 'Phone number is required' })}
              error={!!errors.phone} helperText={errors.phone?.message}
            />
          ) : <ReadField label="Phone Number" value={profile.phone} />}
        </Grid>
        <Grid item xs={12} sm={6}><ReadField label="Department" value={profile.department?.name} /></Grid>

        <Grid item xs={12} sm={6}><ReadField label="Designation" value={profile.designation} /></Grid>

        <Grid item xs={12} sm={6}><ReadField label="Reporting Manager" value={profile.reportingManager?.name} /></Grid>
        <Grid item xs={12} sm={6}><ReadField label="Office Location" value={profile.officeLocation} /></Grid>

        <Grid item xs={12} sm={6}>
          <ReadField label="Joining Date" value={profile.joiningDate ? dayjs(profile.joiningDate).format('MMM D, YYYY') : null} />
        </Grid>

        <Grid item xs={12}>
          {editing ? (
            <TextField
              fullWidth multiline minRows={3} label="Bio / About Me"
              {...register('bio')}
            />
          ) : (
            <Box>
              <Typography variant="caption" color="text.secondary">Bio / About Me</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{profile.bio || '—'}</Typography>
            </Box>
          )}
        </Grid>
      </Grid>

      {editing && (
        <Stack direction="row" spacing={1.5} sx={{ mt: 3 }}>
          <Button variant="contained" disabled={isSubmitting} onClick={handleSubmit(onSave)}>Save</Button>
          <Button variant="text" onClick={onCancel}>Cancel</Button>
        </Stack>
      )}
    </SectionCard>
  );
}

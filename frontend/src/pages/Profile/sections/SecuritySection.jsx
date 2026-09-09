import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import { useForm } from 'react-hook-form';
import { authApi } from '../../../services/domains';
import useToast from '../../../hooks/useToast';
import SectionCard from './SectionCard';

function getStrength(password) {
  let score = 0;
  if (password.length >= 10) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

const STRENGTH_META = [
  { label: 'Very Weak', color: 'error' },
  { label: 'Weak', color: 'error' },
  { label: 'Fair', color: 'warning' },
  { label: 'Good', color: 'info' },
  { label: 'Strong', color: 'success' },
  { label: 'Very Strong', color: 'success' },
];

const REQUIREMENTS = [
  { test: (p) => p.length >= 10, label: 'At least 10 characters' },
  { test: (p) => /[A-Z]/.test(p), label: 'One uppercase letter' },
  { test: (p) => /[a-z]/.test(p), label: 'One lowercase letter' },
  { test: (p) => /[0-9]/.test(p), label: 'One number' },
  { test: (p) => /[^A-Za-z0-9]/.test(p), label: 'One special character' },
];

function PasswordStrengthMeter({ password }) {
  const score = getStrength(password);
  const meta = STRENGTH_META[score];
  return (
    <Box sx={{ mt: 1 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">Password strength</Typography>
        <Typography variant="caption" fontWeight={700} color={`${meta.color}.main`}>{password ? meta.label : ''}</Typography>
      </Stack>
      <LinearProgress variant="determinate" value={(score / 5) * 100} color={meta.color} sx={{ height: 6, borderRadius: 3 }} />
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
        {REQUIREMENTS.map((req) => (
          <Chip
            key={req.label}
            size="small"
            label={req.label}
            color={req.test(password) ? 'success' : 'default'}
            variant={req.test(password) ? 'filled' : 'outlined'}
          />
        ))}
      </Stack>
    </Box>
  );
}

function ChangePasswordCard() {
  const { showSuccess, showError } = useToast();
  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const newPassword = watch('newPassword') || '';

  const onSubmit = async (values) => {
    if (values.newPassword !== values.confirmPassword) {
      showError('New password and confirmation do not match');
      return;
    }
    try {
      await authApi.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      reset();
      showSuccess('Password updated successfully');
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to update password');
    }
  };

  return (
    <SectionCard title="Change Password">
      <Grid container spacing={2.5}>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth size="small" type="password" label="Current Password"
            {...register('currentPassword', { required: 'Current password is required' })}
            error={!!errors.currentPassword} helperText={errors.currentPassword?.message}
          />
        </Grid>
        <Grid item xs={12} sm={6} />
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth size="small" type="password" label="New Password"
            {...register('newPassword', { required: 'New password is required' })}
            error={!!errors.newPassword} helperText={errors.newPassword?.message}
          />
          <PasswordStrengthMeter password={newPassword} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth size="small" type="password" label="Confirm Password"
            {...register('confirmPassword', { required: 'Please confirm your new password' })}
            error={!!errors.confirmPassword} helperText={errors.confirmPassword?.message}
          />
        </Grid>
      </Grid>
      <Button variant="contained" sx={{ mt: 3 }} disabled={isSubmitting} onClick={handleSubmit(onSubmit)}>
        Update Password
      </Button>
    </SectionCard>
  );
}

export default function SecuritySection() {
  return <ChangePasswordCard />;
}

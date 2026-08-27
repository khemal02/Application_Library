import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Avatar from '@mui/material/Avatar';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Chip from '@mui/material/Chip';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AppsOutlinedIcon from '@mui/icons-material/AppsOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { login } from '../../features/auth/authSlice';

const FEATURES = [
  { icon: AppsOutlinedIcon, title: 'Application Tracking & Documentation', text: 'One source of truth for every internal application — architecture, APIs, releases, and more.' },
  { icon: LightbulbOutlinedIcon, title: 'New Application Ideas', text: 'Submit, discuss, and route ideas through a structured review workflow.' },
  { icon: RateReviewOutlinedIcon, title: 'Review & Improvement', text: 'Track feature requests, bugs, and enhancements through to resolution.' },
];

const DEMO_ACCOUNTS = [
  { email: 'admin@aams.local', role: 'Admin' },
  { email: 'ceo@aams.local', role: 'CEO' },
  { email: 'manager@aams.local', role: 'Manager' },
  { email: 'teamlead@aams.local', role: 'Team Lead' },
  { email: 'employee1@aams.local', role: 'Employee' },
];

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const token = useAppSelector((state) => state.auth.token);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, setValue, formState: { errors } } = useForm({
    defaultValues: { email: '', password: '' },
  });

  if (token) return <Navigate to={location.state?.from || '/'} replace />;

  const onSubmit = async (values) => {
    setSubmitting(true);
    setError(null);
    const result = await dispatch(login(values));
    setSubmitting(false);
    if (login.fulfilled.match(result)) {
      navigate(location.state?.from || '/', { replace: true });
    } else {
      setError(result.payload || 'Login failed');
    }
  };

  const fillDemoAccount = (email) => {
    setValue('email', email);
    setValue('password', 'Passw0rd!');
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Brand / hero panel */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '46%',
          minWidth: 420,
          p: 6,
          color: '#fff',
          background: 'linear-gradient(160deg, #1e1b4b 0%, #3730a3 45%, #4f46e5 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute', inset: 0, opacity: 0.25, pointerEvents: 'none',
            backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.25) 0, transparent 40%), radial-gradient(circle at 85% 75%, rgba(14,165,233,0.35) 0, transparent 45%)',
          }}
        />
        <Box sx={{ position: 'relative' }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 6 }}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.15)', width: 44, height: 44 }}>
              <HubOutlinedIcon />
            </Avatar>
            <Typography variant="h6" fontWeight={800} letterSpacing={0.5}>ALMS</Typography>
          </Stack>

          <Typography variant="h3" fontWeight={800} sx={{ mb: 2, lineHeight: 1.2 }}>
            Application Library<br />and Management System
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.75)', maxWidth: 420, mb: 6 }}>
            The single source of truth for every application your organization builds — tracked,
            documented, reviewed, and improved in one place.
          </Typography>

          <Stack spacing={3}>
            {FEATURES.map((f) => (
              <Stack key={f.title} direction="row" spacing={2} alignItems="flex-start">
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.12)', width: 36, height: 36, mt: 0.25 }}>
                  <f.icon fontSize="small" />
                </Avatar>
                <Box>
                  <Typography variant="subtitle2" fontWeight={700}>{f.title}</Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)' }}>{f.text}</Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ position: 'relative', color: 'rgba(255,255,255,0.55)' }}>
          <VerifiedUserOutlinedIcon fontSize="small" />
          <Typography variant="caption">Role-based access · Full audit trail · Enterprise-grade security</Typography>
        </Stack>
      </Box>

      {/* Form panel */}
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 3, sm: 6 } }}>
        <Box sx={{ width: '100%', maxWidth: 400 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1, display: { md: 'none' } }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}><HubOutlinedIcon fontSize="small" /></Avatar>
            <Typography variant="h6" fontWeight={800}>ALMS</Typography>
          </Stack>

          <Typography variant="h4" fontWeight={800} gutterBottom>Welcome back</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            Sign in with your organization credentials to continue.
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <TextField
              fullWidth
              label="Email address"
              autoFocus
              autoComplete="email"
              sx={{ mb: 2.5 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <MailOutlineIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
              {...register('email', { required: 'Email is required' })}
              error={!!errors.email} helperText={errors.email?.message}
            />
            <TextField
              fullWidth
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlinedIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((s) => !s)}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              {...register('password', { required: 'Password is required' })}
              error={!!errors.password} helperText={errors.password?.message}
            />

            <Button
              fullWidth
              variant="contained"
              size="large"
              type="submit"
              disabled={submitting}
              sx={{
                mt: 3.5, py: 1.25, fontSize: '1rem',
                background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                boxShadow: '0 8px 20px rgba(79,70,229,0.35)',
                '&:hover': { background: 'linear-gradient(135deg, #4338ca 0%, #312e81 100%)' },
              }}
            >
              {submitting ? 'Signing in…' : 'Sign In'}
            </Button>
          </Box>

          <Divider sx={{ my: 4 }}>
            <Typography variant="caption" color="text.secondary">Demo access</Typography>
          </Divider>

          <Accordion variant="outlined" disableGutters sx={{ '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2" fontWeight={600}>View demo accounts</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                Password for every demo account: <strong>Passw0rd!</strong> — click a role to autofill.
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {DEMO_ACCOUNTS.map((acct) => (
                  <Chip
                    key={acct.email}
                    label={acct.role}
                    size="small"
                    variant="outlined"
                    onClick={() => fillDemoAccount(acct.email)}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 4, display: 'block', textAlign: 'center' }}>
            © {new Date().getFullYear()} Application Library and Management System. Internal use only.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

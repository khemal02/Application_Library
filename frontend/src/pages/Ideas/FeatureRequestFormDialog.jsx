import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { featureRequestsApi, applicationsApi } from '../../services/domains';

const EMPTY_VALUES = { title: '', description: '', applicationId: '' };

/**
 * Forked from IdeaFormDialog.jsx — see the Ideas/Feature-Requests split. Kept as its own file
 * (rather than a shared component with a category prop) so a developer touching one module's
 * form can't accidentally affect the other's. Feature requests keep the form minimal: an existing
 * Application, Title, Description only — no functional-area/industry/internal-use routing fields,
 * since those only ever mattered for a brand-new idea's own review routing.
 */
export default function FeatureRequestFormDialog({ open, onClose, onCreated }) {
  const [submitError, setSubmitError] = useState(null);
  const [applications, setApplications] = useState([]);
  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    reset(EMPTY_VALUES);
    applicationsApi.list({ limit: 200 }).then((res) => setApplications(res.data)).catch(() => setApplications([]));
  }, [open, reset]);

  const onSubmit = async (values) => {
    setSubmitError(null);
    try {
      const res = await featureRequestsApi.create(values);
      onCreated(res.data);
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Failed to submit — please try again');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Submit a Feature Request for an Existing Application</DialogTitle>
      <DialogContent dividers>
        {submitError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSubmitError(null)}>{submitError}</Alert>}
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12}>
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'text.secondary' }}>
              The idea
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth required label="Title"
              {...register('title', { required: 'Title is required' })}
              error={!!errors.title} helperText={errors.title?.message}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth required multiline minRows={3} label="Description"
              {...register('description', { required: 'Description is required' })}
              error={!!errors.description} helperText={errors.description?.message}
              sx={{ '& .MuiInputBase-input': { textAlign: 'justify' } }}
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'text.secondary' }}>
              Routing &amp; classification
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <Controller
              name="applicationId" control={control} rules={{ required: 'Application is required' }}
              render={({ field }) => (
                <TextField select fullWidth required label="Application" {...field} error={!!errors.applicationId} helperText={errors.applicationId?.message}>
                  {applications.map((a) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
                </TextField>
              )}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={isSubmitting} onClick={handleSubmit(onSubmit)}>
          Submit Feature Request
        </Button>
      </DialogActions>
    </Dialog>
  );
}

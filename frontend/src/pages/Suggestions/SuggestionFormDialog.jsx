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
import Alert from '@mui/material/Alert';
import { applicationsApi, suggestionsApi, departmentsApi } from '../../services/domains';
import { PRIORITY_OPTIONS } from '../../constants/options';

const emptyValues = (applicationId) => ({
  applicationId: applicationId || '',
  departmentId: '', title: '', description: '', currentProblem: '', suggestedSolution: '',
  expectedBenefit: '', priority: 'medium', module: '',
});

/**
 * Same popup pattern as ApplicationFormDialog. `applicationId` is optional — when the dialog is
 * opened from within a specific application's Suggestions tab, it's passed in and the Application
 * field is locked, since the context is already fixed; from the global Suggestions list it's left
 * blank and the user picks one.
 */
export default function SuggestionFormDialog({ open, onClose, onCreated, applicationId, applicationName }) {
  const [applications, setApplications] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [submitError, setSubmitError] = useState(null);
  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: emptyValues(applicationId),
  });

  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    reset(emptyValues(applicationId));
    departmentsApi.list({ limit: 100 }).then((res) => setDepartments(res.data)).catch(() => setDepartments([]));
    if (!applicationId) {
      applicationsApi.list({ limit: 200 }).then((res) => setApplications(res.data)).catch(() => setApplications([]));
    }
  }, [open, applicationId, reset]);

  const onSubmit = async (values) => {
    setSubmitError(null);
    try {
      const res = await suggestionsApi.create({ ...values, departmentId: values.departmentId || null });
      onCreated(res.data);
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Failed to submit suggestion — please try again');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Submit an Improvement Suggestion</DialogTitle>
      <DialogContent dividers>
        {submitError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSubmitError(null)}>{submitError}</Alert>}
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12} sm={6}>
            <Controller name="applicationId" control={control} rules={{ required: 'Application is required' }} render={({ field }) => (
              <TextField select fullWidth label="Application" disabled={!!applicationId} {...field} error={!!errors.applicationId} helperText={errors.applicationId?.message}>
                {applicationId
                  ? <MenuItem value={applicationId}>{applicationName || 'Current application'}</MenuItem>
                  : applications.map((a) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
              </TextField>
            )} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller name="departmentId" control={control} render={({ field }) => (
              <TextField select fullWidth label="Department" {...field}>
                <MenuItem value="">—</MenuItem>
                {departments.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
              </TextField>
            )} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth label="Title" {...register('title', { required: 'Title is required' })} error={!!errors.title} helperText={errors.title?.message} />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth multiline minRows={3} label="Description"
              {...register('description', { required: 'Description is required' })}
              error={!!errors.description} helperText={errors.description?.message}
              sx={{ '& .MuiInputBase-input': { textAlign: 'justify' } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth multiline minRows={2} label="Current Problem" {...register('currentProblem')} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth multiline minRows={2} label="Suggested Solution" {...register('suggestedSolution')} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth multiline minRows={2} label="Expected Benefit" {...register('expectedBenefit')} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Module (e.g. Auth, Dashboard, API)" {...register('module')} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller name="priority" control={control} render={({ field }) => (
              <TextField select fullWidth label="Priority" {...field}>
                {PRIORITY_OPTIONS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </TextField>
            )} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={isSubmitting} onClick={handleSubmit(onSubmit)}>
          Submit Suggestion
        </Button>
      </DialogActions>
    </Dialog>
  );
}

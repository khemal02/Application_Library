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
import { applicationsApi, departmentsApi } from '../../services/domains';
import { APPLICATION_STATUS_OPTIONS, PRIORITY_OPTIONS, INDUSTRY_OPTIONS, FUNCTIONAL_AREA_OPTIONS } from '../../constants/options';

const EMPTY_VALUES = {
  name: '', description: '', status: 'development', priority: 'medium',
  departmentId: '', industry: '', functionalArea: '', startDate: '', releaseDate: '',
  repositoryUrl: '', deploymentUrl: '',
};

// The backend expects null (not empty string) for optional FK/date fields left blank.
function toPayload(values) {
  const payload = { ...values };
  ['departmentId', 'startDate', 'releaseDate'].forEach((key) => {
    if (payload[key] === '') payload[key] = null;
  });
  return payload;
}

export default function ApplicationFormDialog({ open, onClose, onSaved, application }) {
  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm({
    defaultValues: EMPTY_VALUES,
  });
  const [submitError, setSubmitError] = useState(null);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    if (!open) return;
    departmentsApi.list({ limit: 200 }).then((res) => setDepartments(res.data)).catch(() => setDepartments([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    reset(application ? {
      name: application.name || '', description: application.description || '',
      status: application.status || 'development', priority: application.priority || 'medium',
      departmentId: application.department?.id || application.departmentId || '',
      industry: application.industry || '', functionalArea: application.functionalArea || '',
      startDate: application.startDate || '', releaseDate: application.releaseDate || '',
      repositoryUrl: application.repositoryUrl || '', deploymentUrl: application.deploymentUrl || '',
    } : EMPTY_VALUES);
  }, [open, application, reset]);

  const onSubmit = async (values) => {
    setSubmitError(null);
    const payload = toPayload(values);
    try {
      if (application) await applicationsApi.update(application.id, payload);
      else await applicationsApi.create(payload);
      onSaved();
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Failed to save application — please try again');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{application ? 'Edit Application' : 'New Application'}</DialogTitle>
      <DialogContent dividers>
        {submitError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSubmitError(null)}>{submitError}</Alert>}
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12}>
            <TextField fullWidth label="Project Name" {...register('name', { required: 'Project Name is required' })} error={!!errors.name} helperText={errors.name?.message} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth multiline minRows={2} label="Description" {...register('description')} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller name="departmentId" control={control} render={({ field }) => (
              <TextField select fullWidth label="Department" {...field}>
                <MenuItem value="">—</MenuItem>
                {departments.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
              </TextField>
            )} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller name="status" control={control} render={({ field }) => (
              <TextField select fullWidth label="Status" {...field}>
                {APPLICATION_STATUS_OPTIONS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </TextField>
            )} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller name="priority" control={control} render={({ field }) => (
              <TextField select fullWidth label="Priority" {...field}>
                {PRIORITY_OPTIONS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </TextField>
            )} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller name="industry" control={control} render={({ field }) => (
              <TextField select fullWidth label="Industry" {...field}>
                <MenuItem value="">—</MenuItem>
                {INDUSTRY_OPTIONS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </TextField>
            )} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller name="functionalArea" control={control} render={({ field }) => (
              <TextField select fullWidth label="Functional Area" {...field}>
                <MenuItem value="">—</MenuItem>
                {FUNCTIONAL_AREA_OPTIONS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </TextField>
            )} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth label="Start Date" type="date" InputLabelProps={{ shrink: true }}
              {...register('startDate')}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth label="Release Date" type="date" InputLabelProps={{ shrink: true }}
              {...register('releaseDate')}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Repository URL" {...register('repositoryUrl')} placeholder="https://github.com/org/repo" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Deployment URL" {...register('deploymentUrl')} placeholder="https://app.example.com" />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={isSubmitting} onClick={handleSubmit(onSubmit)}>
          {application ? 'Save Changes' : 'Create Application'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

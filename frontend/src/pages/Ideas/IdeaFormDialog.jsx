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
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import { ideasApi, applicationsApi } from '../../services/domains';
import { INDUSTRY_OPTIONS, FUNCTIONAL_AREA_OPTIONS } from '../../constants/options';

const EMPTY_VALUES = {
  title: '', description: '', applicationId: '',
  industry: '', functionalArea: '', internalUse: false, technologiesAndEfficiency: '',
};

/**
 * Same popup pattern as ApplicationFormDialog — used from both the "New Ideas" and "Modify
 * Current Application" lists' submit buttons. `category` controls which of the two this creates.
 * Feature requests keep the form minimal: Application, Title, Description only. Industry,
 * Functional Area, Internal Use, and Technologies and Efficiency are all new_idea-only.
 */
export default function IdeaFormDialog({ open, onClose, onCreated, category = 'new_idea' }) {
  const isFeatureRequest = category === 'existing_app_feature';
  const [submitError, setSubmitError] = useState(null);
  const [applications, setApplications] = useState([]);
  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    reset(EMPTY_VALUES);
    if (isFeatureRequest) {
      applicationsApi.list({ limit: 200 }).then((res) => setApplications(res.data)).catch(() => setApplications([]));
    }
  }, [open, isFeatureRequest, reset]);

  const onSubmit = async (values) => {
    setSubmitError(null);
    try {
      const payload = { ...values, category };
      if (isFeatureRequest) {
        delete payload.industry;
        delete payload.functionalArea;
        delete payload.internalUse;
        delete payload.technologiesAndEfficiency;
      } else {
        delete payload.applicationId;
      }
      const res = await ideasApi.create(payload);
      onCreated(res.data);
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Failed to submit — please try again');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isFeatureRequest ? 'Submit a Feature Request for an Existing Application' : 'Submit a New Application Idea'}</DialogTitle>
      <DialogContent dividers>
        {submitError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSubmitError(null)}>{submitError}</Alert>}
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          {/* "The idea" — what it is, before asking how to classify it. Tab order follows this
              visual order (DOM order === tab order for a plain form with no explicit tabIndex). */}
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
          {!isFeatureRequest && (
            <Grid item xs={12}>
              <TextField
                fullWidth multiline minRows={3} label="Technologies and Efficiency"
                {...register('technologiesAndEfficiency')}
                sx={{ '& .MuiInputBase-input': { textAlign: 'justify' } }}
              />
            </Grid>
          )}

          {/* "Routing & classification" — decides who reviews it and how it's categorized;
              comes after "the idea" so the submitter says what it is before classifying it. */}
          <Grid item xs={12}>
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'text.secondary' }}>
              Routing &amp; classification
            </Typography>
          </Grid>
          {isFeatureRequest && (
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
          )}
          {!isFeatureRequest && (
            <>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="functionalArea" control={control} rules={{ required: 'Functional Area is required' }}
                  render={({ field }) => (
                    <TextField
                      select fullWidth required label="Functional Area" {...field}
                      error={!!errors.functionalArea}
                      helperText={errors.functionalArea?.message || 'Decides which Team Lead, Manager and CEO review this idea.'}
                    >
                      <MenuItem value="">—</MenuItem>
                      {FUNCTIONAL_AREA_OPTIONS.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="industry" control={control}
                  render={({ field }) => (
                    <TextField select fullWidth label="Industry" {...field} helperText="Optional — used for reporting only.">
                      <MenuItem value="">—</MenuItem>
                      {INDUSTRY_OPTIONS.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="internalUse" control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Checkbox checked={!!field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                      label="Internal Use"
                    />
                  )}
                />
              </Grid>
            </>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={isSubmitting} onClick={handleSubmit(onSubmit)}>
          {isFeatureRequest ? 'Submit Feature Request' : 'Submit Idea'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

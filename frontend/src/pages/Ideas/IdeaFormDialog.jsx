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
import { ideasApi } from '../../services/domains';
import { INDUSTRY_OPTIONS, FUNCTIONAL_AREA_OPTIONS } from '../../constants/options';

const EMPTY_VALUES = {
  title: '', description: '',
  industry: '', functionalArea: '', internalUse: false, technologiesAndEfficiency: '',
};

/**
 * Same popup pattern as ApplicationFormDialog — used from the "New Ideas" list's submit button.
 * "Modify Current Application" (feature requests) has its own dialog now — see
 * FeatureRequestFormDialog.jsx — this module always creates a brand-new-idea row.
 */
export default function IdeaFormDialog({ open, onClose, onCreated }) {
  const [submitError, setSubmitError] = useState(null);
  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    reset(EMPTY_VALUES);
  }, [open, reset]);

  const onSubmit = async (values) => {
    setSubmitError(null);
    try {
      const res = await ideasApi.create(values);
      onCreated(res.data);
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Failed to submit — please try again');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Submit a New Application Idea</DialogTitle>
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
          <Grid item xs={12}>
            <TextField
              fullWidth multiline minRows={3} label="Technologies and Efficiency"
              {...register('technologiesAndEfficiency')}
              sx={{ '& .MuiInputBase-input': { textAlign: 'justify' } }}
            />
          </Grid>

          {/* "Routing & classification" — decides who reviews it and how it's categorized;
              comes after "the idea" so the submitter says what it is before classifying it. */}
          <Grid item xs={12}>
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'text.secondary' }}>
              Routing &amp; classification
            </Typography>
          </Grid>
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
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={isSubmitting} onClick={handleSubmit(onSubmit)}>
          Submit Idea
        </Button>
      </DialogActions>
    </Dialog>
  );
}

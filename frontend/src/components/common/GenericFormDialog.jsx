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
import Autocomplete from '@mui/material/Autocomplete';

/**
 * `fields`: [{ name, label, type: 'text'|'textarea'|'select'|'multiselect'|'date', options, required, half }]
 * Renders a create/edit dialog from a field config so each application sub-resource tab
 * (tech stack, features, releases, bugs, roadmap, timeline, API docs, DB docs...) doesn't need
 * its own bespoke form component.
 */
export default function GenericFormDialog({ open, onClose, onSubmit, fields, initialValues = {}, title }) {
  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm({ defaultValues: initialValues });
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (open) { reset(initialValues); setSubmitError(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialValues]);

  const submit = async (values) => {
    setSubmitError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Failed to save — please try again');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {submitError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSubmitError(null)}>{submitError}</Alert>}
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          {fields.map((field) => (
            <Grid item xs={12} sm={field.half ? 6 : 12} key={field.name}>
              {field.type === 'multiselect' ? (
                <Controller
                  name={field.name} control={control} defaultValue={[]}
                  render={({ field: ctrl }) => (
                    <Autocomplete
                      multiple
                      options={field.options}
                      getOptionLabel={(opt) => opt.label}
                      isOptionEqualToValue={(opt, val) => opt.value === val.value}
                      value={field.options.filter((opt) => (ctrl.value || []).includes(opt.value))}
                      onChange={(e, newValue) => ctrl.onChange(newValue.map((opt) => opt.value))}
                      renderInput={(params) => <TextField {...params} label={field.label} />}
                    />
                  )}
                />
              ) : field.type === 'select' ? (
                <Controller
                  name={field.name} control={control} rules={{ required: field.required }}
                  render={({ field: ctrl }) => (
                    <TextField select fullWidth label={field.label} {...ctrl} error={!!errors[field.name]}>
                      {field.options.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                    </TextField>
                  )}
                />
              ) : (
                <TextField
                  fullWidth
                  label={field.label}
                  type={field.type === 'date' ? 'date' : 'text'}
                  multiline={field.type === 'textarea'}
                  minRows={field.type === 'textarea' ? 3 : undefined}
                  InputLabelProps={field.type === 'date' ? { shrink: true } : undefined}
                  {...register(field.name, { required: field.required && `${field.label} is required` })}
                  error={!!errors[field.name]}
                  helperText={errors[field.name]?.message}
                />
              )}
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={isSubmitting} onClick={handleSubmit(submit)}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

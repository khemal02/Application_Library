import { useEffect, useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { featureRequestsApi, applicationsApi } from '../../services/domains';

const EMPTY_VALUES = { title: '', description: '', applicationId: '' };

// Fixed field order — also the order the "+ Add" buttons render in before any are opened.
const FIELD_ORDER = ['title', 'description', 'applicationId'];
// Application stays outside progressive disclosure entirely — always visible as a dropdown, same
// as Functional Area on IdeaFormDialog.jsx (this form's sibling, same pattern throughout).
const ALWAYS_VISIBLE_FIELDS = ['applicationId'];
const FIELD_LABELS = { title: 'Title', description: 'Description', applicationId: 'Application' };
// All three fields are genuinely required at the API level here (unlike IdeaFormDialog, nothing
// in this list is a frontend-only tightening).
const REQUIRED_FIELDS = ['title', 'description', 'applicationId'];

/**
 * Forked from IdeaFormDialog.jsx — see the Ideas/Feature-Requests split. Kept as its own file
 * (rather than a shared component with a category prop) so a developer touching one module's
 * form can't accidentally affect the other's. Feature requests keep the form minimal: an existing
 * Application, Title, Description only — no functional-area/industry/internal-use routing fields,
 * since those only ever mattered for a brand-new idea's own review routing.
 *
 * Same progressive-disclosure shape as IdeaFormDialog.jsx: Title/Description open behind their own
 * "+ Add" button (style matches NotesThread.jsx's reveal-a-composer button), accordion — opening
 * one closes whichever other collapsible field was open, filled or not, so only one is ever open at
 * a time (values already typed aren't lost, react-hook-form keeps them). Application is always
 * visible as a dropdown, never a button. Submit is pre-emptively disabled until all three hold
 * real content, computed via `watch()` independently of whether a field is currently mounted.
 */
export default function FeatureRequestFormDialog({ open, onClose, onCreated }) {
  const [submitError, setSubmitError] = useState(null);
  const [applications, setApplications] = useState([]);
  const [openFields, setOpenFields] = useState([]);
  const fieldRefs = useRef({});
  const pendingFocusRef = useRef(null);
  const {
    register, control, handleSubmit, reset, watch, getValues, formState: { errors, isSubmitting },
  } = useForm({ defaultValues: EMPTY_VALUES });

  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    setOpenFields([]);
    reset(EMPTY_VALUES);
    applicationsApi.list({ limit: 200 }).then((res) => setApplications(res.data)).catch(() => setApplications([]));
  }, [open, reset]);

  useEffect(() => {
    if (pendingFocusRef.current && fieldRefs.current[pendingFocusRef.current]) {
      fieldRefs.current[pendingFocusRef.current].focus();
      pendingFocusRef.current = null;
    }
  }, [openFields]);

  const openField = (key) => {
    pendingFocusRef.current = key;
    setOpenFields([key]);
  };

  const closeFieldIfEmpty = (key) => {
    setTimeout(() => {
      const value = getValues(key);
      if (!String(value || '').trim()) {
        setOpenFields((prev) => prev.filter((k) => k !== key));
      }
    }, 0);
  };

  // Enter confirms/blurs a text field — same "done, move on" moment for both fields. Shift+Enter
  // still inserts a newline on Description instead of confirming, since plain Enter is its normal
  // way to start a new paragraph.
  const handleEnterToBlur = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.target.blur();
    }
  };

  const [titleValue, descriptionValue, applicationIdValue] = watch(REQUIRED_FIELDS);
  const fieldValues = { title: titleValue, description: descriptionValue, applicationId: applicationIdValue };
  const missingRequired = REQUIRED_FIELDS.filter((key) => !String(fieldValues[key] || '').trim());
  const canSubmit = missingRequired.length === 0;

  const onSubmit = async (values) => {
    setSubmitError(null);
    try {
      const res = await featureRequestsApi.create(values);
      onCreated(res.data);
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Failed to submit — please try again');
    }
  };

  const renderField = (key) => {
    switch (key) {
      case 'title': {
        const reg = register('title', { required: 'Title is required' });
        return (
          <TextField
            key={key} fullWidth required label="Title"
            {...reg} onBlur={(e) => { reg.onBlur(e); closeFieldIfEmpty('title'); }}
            onKeyDown={handleEnterToBlur}
            inputRef={(el) => { fieldRefs.current.title = el; }}
            error={!!errors.title} helperText={errors.title?.message}
          />
        );
      }
      case 'description': {
        const reg = register('description', { required: 'Description is required' });
        return (
          <TextField
            key={key} fullWidth required multiline minRows={3} label="Description"
            {...reg} onBlur={(e) => { reg.onBlur(e); closeFieldIfEmpty('description'); }}
            onKeyDown={handleEnterToBlur}
            inputRef={(el) => { fieldRefs.current.description = el; }}
            error={!!errors.description} helperText={errors.description?.message}
            sx={{ '& .MuiInputBase-input': { textAlign: 'justify' } }}
          />
        );
      }
      case 'applicationId':
        return (
          <Controller
            key={key}
            name="applicationId" control={control} rules={{ required: 'Application is required' }}
            render={({ field }) => (
              <TextField
                select fullWidth required label="Application"
                {...field}
                error={!!errors.applicationId} helperText={errors.applicationId?.message}
              >
                {applications.map((a) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
              </TextField>
            )}
          />
        );
      default:
        return null;
    }
  };

  // A collapsed field that already holds a value (closed by the accordion when a different one
  // opened, not because it was ever empty) shows what was typed instead of reverting to a plain
  // "+ Add" prompt. Still just a button — clicking it reopens the same field for editing.
  // Neutral gray, not the outlined Button's default primary/purple — an unopened field should read
  // at the same visual weight as Application's own unfocused state, not stand out in a different
  // color from the rest of the form.
  const renderSlot = (key) => {
    if (ALWAYS_VISIBLE_FIELDS.includes(key) || openFields.includes(key)) return renderField(key);
    const value = fieldValues[key];
    const hasValue = !!String(value || '').trim();
    return (
      <Button
        key={key}
        fullWidth variant="outlined" color="inherit" startIcon={hasValue ? <EditOutlinedIcon /> : <AddIcon />}
        onClick={() => openField(key)}
        sx={{ justifyContent: 'flex-start', color: 'text.secondary', borderColor: 'divider', pr: 1 }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
          {hasValue ? (
            <>
              <Box component="span" sx={{ fontWeight: 700 }}>{FIELD_LABELS[key]}:</Box>
              <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                {value}
              </Box>
            </>
          ) : (
            <span>Add {FIELD_LABELS[key]}{REQUIRED_FIELDS.includes(key) ? ' *' : ''}</span>
          )}
        </Stack>
      </Button>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Submit a Feature Request for an Existing Application</DialogTitle>
      <DialogContent dividers>
        {submitError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSubmitError(null)}>{submitError}</Alert>}
        <Stack spacing={2}>
          {FIELD_ORDER.map((key) => renderSlot(key))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Stack direction="row" justifyContent="flex-end" spacing={1}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" disabled={isSubmitting || !canSubmit} onClick={handleSubmit(onSubmit)}>
            Submit Feature Request
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

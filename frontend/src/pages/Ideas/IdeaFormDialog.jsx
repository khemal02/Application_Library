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
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { ideasApi } from '../../services/domains';
import { INDUSTRY_OPTIONS, FUNCTIONAL_AREA_OPTIONS } from '../../constants/options';

const EMPTY_VALUES = {
  title: '', description: '', proposedSolution: '',
  industry: '', functionalArea: '', internalUse: false, technologiesAndEfficiency: '',
};

// Fixed field order — also the order the "+ Add" buttons render in before any are opened. Matches
// the form's original field order exactly (D2); nothing added, nothing renamed.
const FIELD_ORDER = [
  'title', 'description', 'proposedSolution', 'technologiesAndEfficiency', 'functionalArea', 'industry', 'internalUse',
];
// Functional Area, Industry, and Internal Use stay outside progressive disclosure entirely —
// always visible exactly like the original form (Functional Area/Industry side by side, Internal
// Use as its own checkbox). Only these three are excluded here; everything else in FIELD_ORDER
// still opens behind its own "+ Add" button.
const ALWAYS_VISIBLE_FIELDS = ['functionalArea', 'industry', 'internalUse'];
const FIELD_LABELS = {
  title: 'Title',
  description: 'Problem Statement',
  proposedSolution: 'Solution',
  technologiesAndEfficiency: 'Technologies and Efficiency',
  functionalArea: 'Functional Area',
  industry: 'Industry',
  internalUse: 'Internal Use',
};
// Required on the frontend: Title, Problem Statement, Solution, Technologies and Efficiency, and
// Functional Area (which also drives review routing). This is stricter than the backend, which
// only truly requires title/description/functionalArea (D2) — Solution and Technologies are still
// genuinely optional at the API level, nothing there changed; this only tightens what the UI asks
// for before Submit unlocks. Industry and Internal Use stay optional on both sides.
const REQUIRED_FIELDS = ['title', 'description', 'proposedSolution', 'technologiesAndEfficiency', 'functionalArea'];

/**
 * Progressive disclosure: every field starts collapsed behind a "+ Add {label}" button (style
 * matches NotesThread.jsx's reveal-a-composer button — this codebase's existing idiom for "click to
 * reveal an input", not a dashed border, since no dashed convention exists anywhere in the app).
 * Each field opens IN PLACE, at its own fixed form-order slot, swapping its button for the real
 * input right there — never appended somewhere else on the page — and stays open for the rest of
 * the dialog session.
 *
 * Submit is pre-emptively disabled until every REQUIRED_FIELDS entry holds non-whitespace content
 * — computed independently of whether those fields are mounted (react-hook-
 * form seeds `_formValues` from `defaultValues` at `useForm()` time, so `watch()` reads a closed
 * field's value correctly without ever registering it). This is load-bearing, not cosmetic: a
 * required field's own `required` rule only runs once react-hook-form has registered it, which only
 * happens once its input actually mounts — so a required field left behind its button would never
 * fail validation on submit. The disabled button is what keeps that from silently succeeding.
 */
export default function IdeaFormDialog({ open, onClose, onCreated }) {
  const [submitError, setSubmitError] = useState(null);
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
  }, [open, reset]);

  // Runs after the newly-revealed field has actually mounted, so the ref is populated by the time
  // this fires.
  useEffect(() => {
    if (pendingFocusRef.current && fieldRefs.current[pendingFocusRef.current]) {
      fieldRefs.current[pendingFocusRef.current].focus();
      pendingFocusRef.current = null;
    }
  }, [openFields]);

  // Accordion, not accumulate: opening a field closes whichever other one (of the collapsible
  // fields — this never touches ALWAYS_VISIBLE_FIELDS) was open, filled or not, so only one is
  // ever open at a time. Values already typed into a field that closes this way aren't lost —
  // react-hook-form keeps them (shouldUnregister defaults to false), they just aren't visible
  // again until that field's own button is clicked once more.
  const openField = (key) => {
    pendingFocusRef.current = key;
    setOpenFields([key]);
  };

  // Opened-but-never-filled reverts back to its "+ Add" button on blur — same convention as an
  // "add tag" input: leaving an open field empty is treated as "I didn't mean to open that",
  // whether it's required or not. Deferred a tick: running this synchronously inside the blur
  // handler re-renders (unmounting this field) WHILE the browser is still mid-click on whatever
  // element is about to receive focus next — that race can disconnect the click from React's
  // event handling entirely, so the next field's own "+ Add" button silently does nothing. A
  // macrotask delay lets that click finish being handled first.
  const closeFieldIfEmpty = (key) => {
    setTimeout(() => {
      const value = getValues(key);
      const isEmpty = key === 'internalUse' ? !value : !String(value || '').trim();
      if (isEmpty) {
        setOpenFields((prev) => prev.filter((k) => k !== key));
      }
    }, 0);
  };

  // Enter confirms/blurs a text field — same "done, move on" moment everywhere, Title through
  // Technologies and Efficiency. Shift+Enter still inserts a newline on the multiline fields
  // (Problem Statement, Solution, Technologies and Efficiency) instead of confirming, since plain
  // Enter is their normal way to start a new paragraph.
  const handleEnterToBlur = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.target.blur();
    }
  };

  const [titleValue, descriptionValue, proposedSolutionValue, technologiesValue, functionalAreaValue] = watch(REQUIRED_FIELDS);
  const fieldValues = {
    title: titleValue, description: descriptionValue, proposedSolution: proposedSolutionValue,
    technologiesAndEfficiency: technologiesValue, functionalArea: functionalAreaValue,
  };
  const missingRequired = REQUIRED_FIELDS.filter((key) => !String(fieldValues[key] || '').trim());
  const canSubmit = missingRequired.length === 0;

  const onSubmit = async (values) => {
    setSubmitError(null);
    try {
      const res = await ideasApi.create(values);
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
        const reg = register('description', { required: 'Problem Statement is required' });
        return (
          <TextField
            key={key} fullWidth required multiline minRows={3} label="Problem Statement"
            {...reg} onBlur={(e) => { reg.onBlur(e); closeFieldIfEmpty('description'); }}
            onKeyDown={handleEnterToBlur}
            inputRef={(el) => { fieldRefs.current.description = el; }}
            error={!!errors.description} helperText={errors.description?.message}
            sx={{ '& .MuiInputBase-input': { textAlign: 'justify' } }}
          />
        );
      }
      case 'proposedSolution': {
        const reg = register('proposedSolution', { required: 'Solution is required' });
        return (
          <TextField
            key={key} fullWidth required multiline minRows={3} label="Solution"
            {...reg} onBlur={(e) => { reg.onBlur(e); closeFieldIfEmpty('proposedSolution'); }}
            onKeyDown={handleEnterToBlur}
            inputRef={(el) => { fieldRefs.current.proposedSolution = el; }}
            error={!!errors.proposedSolution} helperText={errors.proposedSolution?.message}
            sx={{ '& .MuiInputBase-input': { textAlign: 'justify' } }}
          />
        );
      }
      case 'technologiesAndEfficiency': {
        const reg = register('technologiesAndEfficiency', { required: 'Technologies and Efficiency is required' });
        return (
          <TextField
            key={key} fullWidth required multiline minRows={3} label="Technologies and Efficiency"
            {...reg} onBlur={(e) => { reg.onBlur(e); closeFieldIfEmpty('technologiesAndEfficiency'); }}
            onKeyDown={handleEnterToBlur}
            inputRef={(el) => { fieldRefs.current.technologiesAndEfficiency = el; }}
            error={!!errors.technologiesAndEfficiency} helperText={errors.technologiesAndEfficiency?.message}
            sx={{ '& .MuiInputBase-input': { textAlign: 'justify' } }}
          />
        );
      }
      case 'functionalArea':
        return (
          <Controller
            key={key}
            name="functionalArea" control={control} rules={{ required: 'Functional Area is required' }}
            render={({ field }) => (
              <TextField
                select fullWidth required label="Functional Area"
                {...field}
                error={!!errors.functionalArea}
                helperText={errors.functionalArea?.message}
              >
                <MenuItem value="">—</MenuItem>
                {FUNCTIONAL_AREA_OPTIONS.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
              </TextField>
            )}
          />
        );
      case 'industry':
        return (
          <Controller
            key={key}
            name="industry" control={control}
            render={({ field }) => (
              <TextField
                select fullWidth label="Industry"
                {...field}
              >
                <MenuItem value="">—</MenuItem>
                {INDUSTRY_OPTIONS.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
              </TextField>
            )}
          />
        );
      case 'internalUse':
        return (
          <Controller
            key={key}
            name="internalUse" control={control}
            render={({ field }) => (
              <FormControlLabel
                control={(
                  <Checkbox
                    checked={!!field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    inputRef={field.ref}
                  />
                )}
                label="Internal Use"
              />
            )}
          />
        );
      default:
        return null;
    }
  };

  // A slot is either the field itself (once opened, or always for Functional Area/Industry) or
  // its "+ Add" button. A collapsed field that already holds a value (closed by the accordion when
  // a different one opened, not because it was ever empty) shows what was typed instead of reverting
  // to a plain "+ Add" prompt — otherwise a filled Title would look identical to a never-touched
  // one the moment focus moves elsewhere, which is exactly what accordion collapse would otherwise
  // do. Still just a button — clicking it reopens the same field for editing.
  // Neutral gray, not the outlined Button's default primary/purple — an unopened field should read
  // at the same visual weight as Application/Functional Area/Industry's own unfocused state, not
  // stand out in a different color from the rest of the form.
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
      <DialogTitle>Submit a New Application Idea</DialogTitle>
      <DialogContent dividers>
        {submitError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSubmitError(null)}>{submitError}</Alert>}

        {/* One list, fixed form-order slots — a field swaps from its button to its input IN PLACE
            when opened, so clicking a button never jumps the reveal somewhere else on the page.
            Functional Area + Industry are ALWAYS_VISIBLE_FIELDS — never buttons, always shown as
            one side-by-side row (matching the original form's pairing); 'industry' is skipped on
            its own turn since it's rendered as part of that pair. A row Stack, not Grid, for the
            pair — Grid's legacy margin-based spacing bleeds past the parent Stack's gap-based
            width and throws off the left/right edge alignment with every sibling row above it. */}
        <Stack spacing={2}>
          {FIELD_ORDER.filter((key) => key !== 'industry').map((key) => (
            key === 'functionalArea' ? (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} key={key}>
                <Box sx={{ flex: 1, minWidth: 0 }}>{renderSlot('functionalArea')}</Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>{renderSlot('industry')}</Box>
              </Stack>
            ) : renderSlot(key)
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Stack direction="row" justifyContent="flex-end" spacing={1}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" disabled={isSubmitting || !canSubmit} onClick={handleSubmit(onSubmit)}>
            Submit Idea
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

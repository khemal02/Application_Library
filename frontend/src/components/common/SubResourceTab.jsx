import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import Autocomplete from '@mui/material/Autocomplete';
import Alert from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { LoadingBlock } from './AsyncState';
import GenericFormDialog from './GenericFormDialog';
import ConfirmDialog from './ConfirmDialog';
import useToast from '../../hooks/useToast';

/** A single field's read/edit state within a record card — click the pencil to edit just this field in place. */
function FieldRow({ field, value, canEdit, onSave, excludeValue }) {
  const isMultiselect = field.type === 'multiselect';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(isMultiselect ? (value ?? []) : (value ?? ''));
  const [saving, setSaving] = useState(false);

  // A record can't depend on itself — filter its own id out of the choice list.
  const multiselectOptions = isMultiselect ? (field.options || []).filter((o) => o.value !== excludeValue) : [];

  const startEdit = () => {
    setDraft(isMultiselect ? (value ?? []) : (value ?? ''));
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch {
      // Error is already surfaced via toast by the caller — stay in edit mode so the user can retry.
    } finally {
      setSaving(false);
    }
  };

  const displayValue = () => {
    if (value === undefined || value === null || value === '') return '—';
    if (field.type === 'select') return field.options?.find((o) => o.value === value)?.label || value;
    return String(value);
  };

  return (
    <Box sx={{ py: 1.25 }}>
      <Stack direction="row" alignItems="flex-start" spacing={1}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">{field.label}</Typography>
          {editing ? (
            field.type === 'select' ? (
              <TextField select fullWidth size="small" value={draft} onChange={(e) => setDraft(e.target.value)} sx={{ mt: 0.5 }} autoFocus>
                {field.options.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
              </TextField>
            ) : isMultiselect ? (
              <Autocomplete
                multiple
                autoFocus
                size="small"
                options={multiselectOptions}
                getOptionLabel={(opt) => opt.label}
                isOptionEqualToValue={(opt, val) => opt.value === val.value}
                value={multiselectOptions.filter((opt) => (draft || []).includes(opt.value))}
                onChange={(e, newValue) => setDraft(newValue.map((opt) => opt.value))}
                renderInput={(params) => <TextField {...params} />}
                sx={{ mt: 0.5 }}
              />
            ) : (
              <TextField
                fullWidth size="small" sx={{ mt: 0.5 }} autoFocus
                type={field.type === 'date' ? 'date' : 'text'}
                multiline={field.type === 'textarea'}
                minRows={field.type === 'textarea' ? 3 : undefined}
                InputLabelProps={field.type === 'date' ? { shrink: true } : undefined}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            )
          ) : field.type === 'select' && value ? (
            <Box sx={{ mt: 0.5 }}><Chip size="small" variant="outlined" label={displayValue()} /></Box>
          ) : isMultiselect ? (
            <Box sx={{ mt: 0.5 }}>
              {value && value.length > 0 ? (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {value.map((depId) => (
                    <Chip key={depId} size="small" variant="outlined" label={field.options?.find((o) => o.value === depId)?.label || depId} />
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">None</Typography>
              )}
            </Box>
          ) : (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{displayValue()}</Typography>
          )}
        </Box>
        {canEdit && (
          editing ? (
            <Stack direction="row">
              <IconButton size="small" color="primary" aria-label={`Save ${field.label}`} disabled={saving} onClick={save}>
                <CheckIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" aria-label={`Cancel editing ${field.label}`} disabled={saving} onClick={() => setEditing(false)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          ) : (
            <IconButton size="small" aria-label={`Edit ${field.label}`} onClick={startEdit}>
              <EditIcon fontSize="small" />
            </IconButton>
          )
        )}
      </Stack>
    </Box>
  );
}

/** One record rendered as fields stacked top to bottom, each independently editable in place. */
function RecordCard({
  record, fields, entityLabel, canEdit, canDelete, onSaveField, onDeleteRequest, toFormValue, renderMeta,
  hideFieldList, metaPosition = 'top',
}) {
  const formValue = toFormValue(record);
  const heading = record.title || record.name || record.docTableName || record.endpoint || record.version || entityLabel;
  const meta = renderMeta?.(record);

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="subtitle2" fontWeight={700}>{heading}</Typography>
        {canDelete && (
          <IconButton size="small" aria-label={`Delete ${entityLabel}`} onClick={() => onDeleteRequest(record)}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>
      {meta && metaPosition === 'top' && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>{meta}</Typography>
      )}
      {!hideFieldList && (
        <Stack divider={<Divider />}>
          {fields.map((field) => (
            <FieldRow
              key={field.name}
              field={field}
              value={formValue[field.name]}
              canEdit={canEdit}
              onSave={(draft) => onSaveField(record, field, draft)}
              excludeValue={field.type === 'multiselect' ? record.id : undefined}
            />
          ))}
        </Stack>
      )}
      {meta && metaPosition === 'bottom' && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'right', mt: 1 }}>{meta}</Typography>
      )}
    </Paper>
  );
}

/**
 * Top-to-bottom field list + create/delete for an application sub-resource (tech stack, features,
 * releases, bugs, known issues, roadmap, timeline, API docs, DB docs, AI prompts). Each record is
 * a card listing its fields vertically; each field has its own inline edit control instead of a
 * single whole-record edit dialog. Creation still goes through the shared form dialog, since
 * filling in a brand-new record field-by-field with no context isn't an improvement over a form.
 */
export default function SubResourceTab({
  api, applicationId, fields, title, entityLabel, canCreate = true, canEdit = true, canDelete = true,
  transformBeforeSubmit, transformToForm, onDataChange, renderMeta, hideFieldList, metaPosition,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const { showSuccess, showError } = useToast();

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.list(applicationId, { limit: 100 });
      setRows(res.data);
      onDataChange?.(res.data);
    } catch (err) {
      setLoadError(err.response?.data?.message || `Failed to load ${entityLabel.toLowerCase()} entries`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [applicationId]);

  const toFormValue = (record) => (transformToForm ? transformToForm(record) : record);

  const handleCreate = async (values) => {
    const payload = transformBeforeSubmit ? transformBeforeSubmit(values) : values;
    await api.create(applicationId, payload);
    setFormOpen(false);
    showSuccess(`${entityLabel} added`);
    await load();
  };

  const handleSaveField = async (record, field, draft) => {
    const transformed = transformBeforeSubmit ? transformBeforeSubmit({ [field.name]: draft }) : { [field.name]: draft };
    try {
      await api.update(applicationId, record.id, { [field.name]: transformed[field.name] });
      showSuccess(`${field.label} updated`);
      await load();
    } catch (err) {
      showError(err.response?.data?.message || `Failed to update ${field.label}`);
      throw err;
    }
  };

  const handleDelete = async () => {
    try {
      await api.remove(applicationId, deleting.id);
      setDeleting(null);
      showSuccess(`${entityLabel} deleted`);
      await load();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to delete — please try again');
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
        {canCreate && (
          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>
            Add {entityLabel}
          </Button>
        )}
      </Stack>

      {loadError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLoadError(null)}>{loadError}</Alert>}

      {loading ? (
        <LoadingBlock minHeight="120px" />
      ) : rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No {entityLabel.toLowerCase()} entries yet</Typography>
      ) : (
        rows.map((record) => (
          <RecordCard
            key={record.id}
            record={record}
            fields={fields}
            entityLabel={entityLabel}
            canEdit={canEdit}
            canDelete={typeof canDelete === 'function' ? canDelete(record) : canDelete}
            renderMeta={renderMeta}
            hideFieldList={hideFieldList}
            metaPosition={metaPosition}
            onSaveField={handleSaveField}
            onDeleteRequest={setDeleting}
            toFormValue={toFormValue}
          />
        ))
      )}

      <GenericFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreate}
        fields={fields}
        initialValues={{}}
        title={`Add ${entityLabel}`}
      />

      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${entityLabel.toLowerCase()}?`}
        description={`This will permanently remove "${deleting?.name || deleting?.title || ''}".`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </Box>
  );
}

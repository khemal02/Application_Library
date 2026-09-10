import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CloseIcon from '@mui/icons-material/Close';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import dayjs from 'dayjs';
import { commentsApi, attachmentsApi } from '../../services/domains';
import { useAppSelector } from '../../app/hooks';
import humanize from '../../utils/humanize';
import avatarColor from '../../utils/avatarColor';
import AttachmentGallery from './AttachmentGallery';

const MAX_WORDS = 400;
const NOTE_ATTACHMENT_ENTITY = 'comment';

function wordCount(text) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function NoteCard({
  note, hideAuthor, hideDate, plain,
}) {
  const content = (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      {!hideAuthor && (
        <Avatar
          sx={{ width: 36, height: 36, bgcolor: avatarColor(note.author?.id || note.author?.name), color: '#fff' }}
          src={note.author?.avatarUrl || undefined}
        >
          {note.author?.name?.[0]}
        </Avatar>
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          {!hideAuthor && <Typography variant="body2" fontWeight={700}>{note.author?.name}</Typography>}
          {!hideAuthor && note.author?.role?.name && (
            <Chip size="small" variant="outlined" label={humanize(note.author.role.name)} />
          )}
          {!hideDate && (
            <Typography variant="caption" color="text.secondary">{dayjs(note.createdAt).format('MMM D, YYYY HH:mm')}</Typography>
          )}
        </Stack>
        {note.body && (
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>{note.body}</Typography>
        )}
        <AttachmentGallery entityType={NOTE_ATTACHMENT_ENTITY} entityId={note.id} />
      </Box>
    </Stack>
  );

  // Plain mode (stage Notes on Change Request/Application Tracking cards): the note already sits
  // inside the stage's own outlined Paper — wrapping it in a second nested box read as a box-in-a-box.
  // A bottom divider between entries takes its place instead of a border all the way around.
  if (plain) {
    return (
      <Box sx={{ mb: 2, pb: 2, '&:not(:last-of-type)': { borderBottom: 1, borderColor: 'divider' } }}>
        {content}
      </Box>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      {content}
    </Paper>
  );
}

/**
 * Flat (non-threaded) list of longer-form entries, each posted by a user (shown with name + role)
 * and optionally carrying screenshot attachments. New entries are composed one at a time via the
 * "+" button rather than a single always-open box, per how this is used on the Idea detail page.
 *
 * `editableOwn` (stage Notes on Change Request/Application Tracking cards): once the signed-in
 * user already has a note here, the bottom control becomes "Edit" on THEIR note instead of "Add"
 * another one — a stage note is a single evolving work-log entry per person, not an open thread,
 * so there's nothing to add a second one of. Other people's notes are unaffected and still just
 * display; a user with no note of their own yet still sees "Add" until they write one.
 */
export default function NotesThread({
  entityType, entityId, title = 'Details', emptyLabel = 'Nothing added yet — click + to add the first detail.',
  disabled = false, disabledReason = 'This is now read-only.', hideAuthor = false, hideDate = false, plain = false, editableOwn = false,
}) {
  const currentUser = useAppSelector((s) => s.auth.user);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const ownNote = editableOwn ? notes.find((n) => n.author?.id === currentUser?.id) : null;

  const load = async () => {
    setError(null);
    try {
      const res = await commentsApi.list(entityType, entityId);
      setNotes(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [entityType, entityId]);

  const words = wordCount(text);
  const overLimit = words > MAX_WORDS;

  const openComposer = () => {
    setError(null);
    setEditingNoteId(null);
    setText('');
    setFiles([]);
    setComposing(true);
  };

  const openEditor = (note) => {
    setError(null);
    setEditingNoteId(note.id);
    setText(note.body || '');
    setFiles([]);
    setComposing(true);
  };

  const closeComposer = () => {
    setComposing(false);
    setEditingNoteId(null);
    setText('');
    setFiles([]);
  };

  const addFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (picked.length) setFiles((prev) => [...prev, ...picked]);
  };

  const removeFile = (index) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const canSubmit = !!text.trim() || files.length > 0;

  const submit = async () => {
    if (!canSubmit || overLimit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const noteId = editingNoteId
        ? (await commentsApi.update(editingNoteId, { body: text.trim() })).data.id
        : (await commentsApi.create({ entityType, entityId, body: text.trim() })).data.id;
      for (const file of files) {
        await attachmentsApi.upload(NOTE_ATTACHMENT_ENTITY, noteId, file);
      }
      closeComposer();
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>{title}</Typography>

      {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>{error}</Alert>}

      {!loading && notes.length === 0 && !composing && !disabled && (
        <Typography variant="body2" color="text.secondary">{emptyLabel}</Typography>
      )}
      {!loading && notes.length === 0 && disabled && (
        <Typography variant="body2" color="text.secondary">Nothing was added while this was open.</Typography>
      )}

      {notes.map((note) => (
        <NoteCard key={note.id} note={note} hideAuthor={hideAuthor} hideDate={hideDate} plain={plain} />
      ))}

      {composing && !disabled && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <TextField
            fullWidth multiline minRows={4} autoFocus
            placeholder="Write the details here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          {files.length > 0 && (
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
              {files.map((f, i) => (
                <Chip key={`${f.name}-${i}`} label={f.name} size="small" onDelete={() => removeFile(i)} />
              ))}
            </Stack>
          )}

          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button size="small" startIcon={<AttachFileIcon />} onClick={() => fileInputRef.current?.click()}>
                Attach screenshot
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={addFiles} aria-label="Attach screenshot" />
            </Stack>
            <Typography variant="caption" color={overLimit ? 'error' : 'text.secondary'}>
              {words} / {MAX_WORDS} words
            </Typography>
          </Stack>

          <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1.5 }}>
            <Button size="small" startIcon={<CloseIcon />} onClick={closeComposer} disabled={submitting}>Cancel</Button>
            <Button size="small" variant="contained" disabled={submitting || !canSubmit || overLimit} onClick={submit}>
              {submitting ? (editingNoteId ? 'Saving...' : 'Submitting...') : (editingNoteId ? 'Save' : 'Submit')}
            </Button>
          </Stack>
        </Paper>
      )}

      {!composing && !disabled && (
        <Stack direction="row" justifyContent={plain ? 'flex-start' : 'flex-end'} sx={{ mt: notes.length > 0 ? 2 : 1 }}>
          {ownNote ? (
            <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => openEditor(ownNote)}>
              Edit
            </Button>
          ) : (
            <Button variant="outlined" startIcon={<AddIcon />} onClick={openComposer}>
              Add
            </Button>
          )}
        </Stack>
      )}

      {!composing && disabled && disabledReason && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: notes.length > 0 ? 2 : 1, textAlign: 'right' }}>
          {disabledReason}
        </Typography>
      )}
    </Box>
  );
}

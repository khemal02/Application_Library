import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFileOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import UploadIcon from '@mui/icons-material/UploadFileOutlined';
import { attachmentsApi } from '../../services/domains';

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AttachmentsPanel({ entityType, entityId }) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const load = async () => {
    setError(null);
    try {
      const res = await attachmentsApi.list(entityType, entityId);
      setAttachments(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load attachments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [entityType, entityId]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await attachmentsApi.upload(entityType, entityId, file);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    setError(null);
    try {
      await attachmentsApi.remove(id);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete attachment');
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle1" fontWeight={700}>Attachments ({attachments.length})</Typography>
        <Button
          size="small"
          startIcon={uploading ? <CircularProgress size={14} /> : <UploadIcon />}
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </Button>
        <input ref={fileInputRef} type="file" hidden onChange={handleUpload} aria-label="Upload attachment" />
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>{error}</Alert>}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={24} /></Box>
      ) : (
        <List dense>
          {attachments.map((a) => (
            <ListItem
              key={a.id}
              secondaryAction={(
                <IconButton size="small" aria-label={`Delete ${a.fileName}`} onClick={() => handleDelete(a.id)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              )}
              component="a"
              href={a.url}
              target="_blank"
              rel="noreferrer"
              sx={{ textDecoration: 'none', color: 'inherit' }}
            >
              <ListItemIcon><InsertDriveFileIcon /></ListItemIcon>
              <ListItemText primary={a.fileName} secondary={formatSize(a.fileSize)} />
            </ListItem>
          ))}
          {attachments.length === 0 && <Typography variant="body2" color="text.secondary">No attachments yet</Typography>}
        </List>
      )}
    </Box>
  );
}

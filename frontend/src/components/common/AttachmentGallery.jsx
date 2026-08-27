import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import VisibilityIcon from '@mui/icons-material/Visibility';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFileOutlined';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdfOutlined';
import DescriptionIcon from '@mui/icons-material/DescriptionOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import { attachmentsApi } from '../../services/domains';

const EXTENSION_STYLE = {
  pdf: { label: 'PDF', color: '#C62828', icon: PictureAsPdfIcon },
  doc: { label: 'DOC', color: '#1565C0', icon: DescriptionIcon },
  docx: { label: 'DOC', color: '#1565C0', icon: DescriptionIcon },
  xls: { label: 'XLS', color: '#2E7D32', icon: DescriptionIcon },
  xlsx: { label: 'XLS', color: '#2E7D32', icon: DescriptionIcon },
  ppt: { label: 'PPT', color: '#D84315', icon: DescriptionIcon },
  pptx: { label: 'PPT', color: '#D84315', icon: DescriptionIcon },
};

function fileExtension(fileName) {
  const dot = fileName?.lastIndexOf('.');
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : '';
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Thumbnail grid + in-app image preview for whatever attachmentsApi.list(entityType, entityId)
 * returns. Shared by NotesThread and CommentThread — both key attachments off the specific
 * comment/note row they're attached to (entityType='comment'), not the parent idea/application.
 *
 * `rich` (default false, so NotesThread's existing look is untouched) swaps the compact
 * thumbnail-only grid for a larger preview with a hover "View" affordance, a filename/size/
 * download footer, and non-image files rendered as a typed file row instead of a bare chip —
 * Ideas' Discussion is the only caller that turns this on.
 */
export default function AttachmentGallery({ entityType, entityId, rich = false }) {
  const [attachments, setAttachments] = useState([]);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    attachmentsApi.list(entityType, entityId).then((res) => setAttachments(res.data)).catch(() => setAttachments([]));
  }, [entityType, entityId]);

  if (attachments.length === 0) return null;

  if (!rich) {
    return (
      <>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
          {attachments.map((a) => (
            a.mimeType?.startsWith('image/') ? (
              <ButtonBase
                key={a.id} onClick={() => setPreview(a)} aria-label={`View ${a.fileName}`}
                sx={{ width: 96, height: 96, borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}
              >
                <Box component="img" src={a.url} alt={a.fileName} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </ButtonBase>
            ) : (
              <Chip key={a.id} component="a" href={a.url} target="_blank" rel="noreferrer" clickable
                icon={<InsertDriveFileIcon />} label={a.fileName} size="small" />
            )
          ))}
        </Stack>

        {/* Images preview in-app rather than opening the raw /uploads URL directly, which the
            backend always serves as Content-Disposition: attachment and would force a download —
            the explicit Download button below is the deliberate way to still get the file. */}
        <Dialog open={!!preview} onClose={() => setPreview(null)} maxWidth="lg">
          {preview && (
            <Box sx={{ position: 'relative', lineHeight: 0 }}>
              <Stack direction="row" spacing={1} sx={{ position: 'absolute', top: 8, right: 8 }}>
                <IconButton
                  component="a" href={preview.url} download={preview.fileName} target="_blank" rel="noreferrer"
                  aria-label={`Download ${preview.fileName}`}
                  sx={{ bgcolor: 'background.paper', '&:hover': { bgcolor: 'background.paper' } }}
                >
                  <DownloadIcon />
                </IconButton>
                <IconButton
                  onClick={() => setPreview(null)} aria-label="Close preview"
                  sx={{ bgcolor: 'background.paper', '&:hover': { bgcolor: 'background.paper' } }}
                >
                  <CloseIcon />
                </IconButton>
              </Stack>
              <Box component="img" src={preview.url} alt={preview.fileName} sx={{ display: 'block', maxWidth: '90vw', maxHeight: '85vh' }} />
            </Box>
          )}
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Stack direction="row" spacing={1.5} flexWrap="wrap" sx={{ mt: 1.5 }}>
        {attachments.map((a) => {
          if (a.mimeType?.startsWith('image/')) {
            return (
              <Box
                key={a.id}
                sx={{ width: 190, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}
              >
                <ButtonBase
                  onClick={() => setPreview(a)} aria-label={`View ${a.fileName}`}
                  sx={{
                    position: 'relative', width: '100%', height: 128, display: 'block',
                    '&:hover .attachment-hover-overlay': { opacity: 1 },
                  }}
                >
                  <Box component="img" src={a.url} alt={a.fileName} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <Box
                    className="attachment-hover-overlay"
                    sx={(theme) => ({
                      position: 'absolute', inset: 0, bgcolor: alpha(theme.palette.common.black, 0.55),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: 0, transition: 'opacity 0.14s',
                    })}
                  >
                    <Chip
                      size="small" icon={<VisibilityIcon fontSize="small" />} label="View"
                      sx={{ bgcolor: 'background.paper', fontWeight: 700 }}
                    />
                  </Box>
                </ButtonBase>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1, py: 0.75, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="caption" fontWeight={600} noWrap sx={{ flex: 1 }}>{a.fileName}</Typography>
                  <Typography variant="caption" color="text.secondary">{formatBytes(a.fileSize)}</Typography>
                  <IconButton
                    size="small" component="a" href={a.url} download={a.fileName} target="_blank" rel="noreferrer"
                    aria-label={`Download ${a.fileName}`} onClick={(e) => e.stopPropagation()}
                  >
                    <DownloadIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>
            );
          }

          const ext = fileExtension(a.fileName);
          const style = EXTENSION_STYLE[ext] || { label: ext ? ext.toUpperCase().slice(0, 4) : 'FILE', color: '#5A6072', icon: InsertDriveFileIcon };
          const TypeIcon = style.icon;
          return (
            <Stack
              key={a.id} direction="row" spacing={1.25} alignItems="center"
              sx={{ width: 250, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1 }}
            >
              <Box sx={{
                width: 30, height: 30, borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: style.color, color: '#fff', flexShrink: 0,
              }}>
                <TypeIcon sx={{ fontSize: 16 }} />
              </Box>
              <Typography variant="caption" fontWeight={600} noWrap sx={{ flex: 1 }}>{a.fileName}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>{formatBytes(a.fileSize)}</Typography>
              <IconButton size="small" component="a" href={a.url} download={a.fileName} target="_blank" rel="noreferrer" aria-label={`Download ${a.fileName}`}>
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Stack>
          );
        })}
      </Stack>

      {/* Esc closes via MUI Dialog's default keydown handling — no extra wiring needed. Deliberately
          a near-black scrim in BOTH app themes (a photo-viewer convention, not a light-mode leak) —
          expressed via theme.palette.common.black + alpha() rather than fixed hex, so it's still a
          real theme value rather than a color that silently ignores the theme object entirely. */}
      <Dialog open={!!preview} onClose={() => setPreview(null)} maxWidth="lg" fullWidth>
        {preview && (
          <Box>
            <Stack
              direction="row" alignItems="center" spacing={1.5}
              sx={(theme) => ({ px: 2, py: 1.5, bgcolor: alpha(theme.palette.common.black, 0.92), color: theme.palette.common.white })}
            >
              <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>
                {preview.fileName} · {formatBytes(preview.fileSize)}
              </Typography>
              <IconButton
                size="small" component="a" href={preview.url} download={preview.fileName} target="_blank" rel="noreferrer"
                aria-label={`Download ${preview.fileName}`}
                sx={(theme) => ({
                  color: theme.palette.common.white, bgcolor: alpha(theme.palette.common.white, 0.14),
                  '&:hover': { bgcolor: alpha(theme.palette.common.white, 0.24) },
                })}
              >
                <DownloadIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small" onClick={() => setPreview(null)} aria-label="Close preview"
                sx={(theme) => ({
                  color: theme.palette.common.white, bgcolor: alpha(theme.palette.common.white, 0.14),
                  '&:hover': { bgcolor: alpha(theme.palette.common.white, 0.24) },
                })}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
            <Box sx={(theme) => ({ display: 'flex', justifyContent: 'center', bgcolor: alpha(theme.palette.common.black, 0.85), p: 3 })}>
              <Box component="img" src={preview.url} alt={preview.fileName} sx={{ display: 'block', maxWidth: '100%', maxHeight: '75vh' }} />
            </Box>
          </Box>
        )}
      </Dialog>
    </>
  );
}

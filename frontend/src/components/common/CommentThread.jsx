import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ReplyIcon from '@mui/icons-material/Reply';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import LockIcon from '@mui/icons-material/Lock';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import dayjs from 'dayjs';
import { commentsApi, attachmentsApi } from '../../services/domains';
import { useAppSelector } from '../../app/hooks';
import useToast from '../../hooks/useToast';
import avatarColor from '../../utils/avatarColor';
import humanize from '../../utils/humanize';
import AttachmentGallery from './AttachmentGallery';
import ConfirmDialog from './ConfirmDialog';

const DEFAULT_MAX_COMMENT_LENGTH = 100;
const ATTACHMENT_ENTITY = 'comment';

// Chain-role badges/rings — team_lead/manager/ceo get a soft-tinted chip AND a matching ring on
// the avatar, mapped onto the theme's own success/warning/primary palette entries (not fixed hex)
// so both render correctly in light and dark mode — same alpha()-over-palette-main formula
// StatusBadge already uses. Submitter and plain (no chain match) fall back to an outlined chip
// with no custom color at all, since MUI's outlined variant is already theme-safe on its own —
// same convention NotesThread uses for its role chip.
const ROLE_PALETTE_KEY = { team_lead: 'success', manager: 'warning', ceo: 'primary' };

/**
 * Resolves the badge(s) for one comment's author, matching on IDENTITY not role name — a Manager
 * badges "Reviewer 2 · Manager" only if they are THIS idea's recorded/eligible manager slot, not
 * because a Manager somewhere in the org happened to comment. `reviewChain[i].reviewer` is
 * populated for unfilled slots too (the expected eligible person) — badging them before they vote
 * is intentional. Where the org-wide fallback applies, `reviewer` is null, so nothing matches and
 * it falls through to a plain role chip. Both "Submitter" and a chain badge can apply at once (a
 * Team Lead reviewing their own idea) — both chips render rather than picking one.
 */
function resolveBadges(author, submitterId, reviewChain) {
  const badges = [];
  if (author?.id && author.id === submitterId) badges.push({ kind: 'submitter', label: 'Submitter' });
  const slot = (reviewChain || []).find((s) => s.reviewer?.id === author?.id);
  if (slot) badges.push({ kind: slot.roleName, label: `${slot.reviewerLabel} · ${slot.roleLabel}` });
  if (badges.length === 0) badges.push({ kind: 'plain', label: humanize(author?.role?.name) });
  return badges;
}

function countAll(list) {
  return (list || []).reduce((sum, c) => sum + 1 + countAll(c.replies), 0);
}

// Ruling: cap nesting at one level. A reply-to-a-reply is reachable today and the recursive
// renderer would indent forever in a narrow column, so every descendant — any depth — lands in
// the SAME rail as the top-level parent's replies, tagged with who it was actually answering
// (null for a direct reply to the root, since that's already clear from context). Presentation
// only: the underlying nesting data and the API are untouched.
function flattenDescendants(replies, answeringName = null) {
  const flat = [];
  for (const r of replies || []) {
    flat.push({ comment: r, answeringName });
    if (r.replies?.length) flat.push(...flattenDescendants(r.replies, r.author?.name));
  }
  return flat;
}

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return `Yesterday, ${dayjs(dateStr).format('h:mm A')}`;
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return dayjs(dateStr).format('MMM D, YYYY');
}

function RoleBadges({ author, submitterId, reviewChain }) {
  const badges = resolveBadges(author, submitterId, reviewChain);
  return (
    <>
      {badges.map((b) => {
        const paletteKey = ROLE_PALETTE_KEY[b.kind];
        return (
          <Chip
            key={b.kind} size="small" label={b.label}
            variant={paletteKey ? 'filled' : 'outlined'}
            sx={paletteKey ? (theme) => {
              const isDark = theme.palette.mode === 'dark';
              const main = theme.palette[paletteKey].main;
              return {
                bgcolor: alpha(main, isDark ? 0.22 : 0.12),
                color: isDark ? (theme.palette[paletteKey].light || main) : main,
                fontWeight: 700,
              };
            } : undefined}
          />
        );
      })}
    </>
  );
}

function CommentRow({
  comment, answeringName, isFlatEntry, entityType, entityId, onChanged, onError,
  currentUserId, canManageAll, maxLength, disabled, allowAttachments,
  richMode, showRoleBadges, attachmentViewer, collapsibleComposer, submitterId, reviewChain,
}) {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyFiles, setReplyFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const replyFileInputRef = useRef(null);
  const { showSuccess } = useToast();

  const addReplyFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (picked.length) setReplyFiles((prev) => [...prev, ...picked]);
  };

  const removeReplyFile = (index) => setReplyFiles((prev) => prev.filter((_, i) => i !== index));

  const cancelReply = () => {
    setReplyText('');
    setReplyFiles([]);
    setReplying(false);
  };

  const canSubmitReply = !!replyText.trim() || replyFiles.length > 0;

  const submitReply = async () => {
    if (!canSubmitReply || submitting) return;
    setSubmitting(true);
    try {
      const res = await commentsApi.create({ entityType, entityId, parentCommentId: comment.id, body: replyText.trim() });
      const replyId = res.data.id;
      for (const file of replyFiles) {
        await attachmentsApi.upload(ATTACHMENT_ENTITY, replyId, file);
      }
      setReplyText('');
      setReplyFiles([]);
      setReplying(false);
      await onChanged();
      showSuccess('Reply posted');
    } catch (err) {
      onError(err.response?.data?.message || 'Failed to post reply');
    } finally {
      setSubmitting(false);
    }
  };

  // Enter posts; Shift+Enter still inserts a newline (the standard chat-input convention) so a
  // multi-line reply is still possible without it submitting halfway through.
  const handleReplyKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitReply();
    }
  };

  // No edit action, deliberately: this thread is part of the decision record once a reviewer has
  // read it, and a rewritable comment would make that record untrustworthy. Corrections happen by
  // posting a follow-up, not by mutating what was already said. Delete stays as the one removal
  // path, blocked once the idea is decided (see the freeze check in comments.service.js#remove) —
  // don't add a PATCH/update route or an Edit button here.
  const remove = async () => {
    try {
      await commentsApi.remove(comment.id);
      await onChanged();
      showSuccess('Comment deleted');
    } catch (err) {
      onError(err.response?.data?.message || 'Failed to delete comment');
    } finally {
      setConfirmOpen(false);
    }
  };

  // Always confirm before deleting — a comment is someone's word on the record, in any of the
  // three domains this component is shared across, not just Ideas' decision-record framing.
  const handleDeleteClick = () => setConfirmOpen(true);

  const canDelete = comment.userId === currentUserId || canManageAll;
  const flatReplies = !isFlatEntry ? flattenDescendants(comment.replies) : [];
  const ringKind = richMode && showRoleBadges
    ? resolveBadges(comment.author, submitterId, reviewChain).find((b) => ROLE_PALETTE_KEY[b.kind])?.kind
    : null;
  const ringPaletteKey = ringKind ? ROLE_PALETTE_KEY[ringKind] : null;
  const avatarSize = isFlatEntry ? 26 : 32;

  return (
    <Box sx={{ mb: 1.5, '&:hover .comment-actions': { opacity: 1 } }}>
      <Stack direction="row" spacing={1.5}>
        <Avatar
          sx={(theme) => {
            const base = {
              width: avatarSize, height: avatarSize, flex: `0 0 ${avatarSize}px`, fontSize: avatarSize <= 26 ? 12 : undefined,
              bgcolor: avatarColor(comment.author?.id || comment.author?.name), color: '#fff',
            };
            if (!ringPaletteKey) return base;
            const isDark = theme.palette.mode === 'dark';
            const ringColor = alpha(theme.palette[ringPaletteKey].main, isDark ? 0.6 : 0.35);
            return { ...base, boxShadow: `0 0 0 2px ${theme.palette.background.paper}, 0 0 0 4px ${ringColor}` };
          }}
          src={comment.author?.avatarUrl || undefined}
        >
          {comment.author?.name?.[0]}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {richMode && answeringName && (
            <Typography variant="caption" color="primary" sx={{ display: 'block', mb: 0.25, fontWeight: 600 }}>
              ↳ @{answeringName}
            </Typography>
          )}
          <Stack direction="row" spacing={1} alignItems="baseline" flexWrap="wrap" useFlexGap>
            <Typography variant="body2" fontWeight={600}>{comment.author?.name}</Typography>
            {richMode && showRoleBadges && (
              <RoleBadges author={comment.author} submitterId={submitterId} reviewChain={reviewChain} />
            )}
            <Typography
              variant="caption" color="text.secondary"
              title={dayjs(comment.createdAt).format('MMM D, YYYY HH:mm')}
              sx={{ cursor: richMode ? 'help' : undefined }}
            >
              {richMode ? timeAgo(comment.createdAt) : dayjs(comment.createdAt).format('MMM D, YYYY HH:mm')}
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{comment.body}</Typography>
          {allowAttachments && <AttachmentGallery entityType={ATTACHMENT_ENTITY} entityId={comment.id} rich={attachmentViewer} />}

          <Stack
            direction="row" spacing={richMode ? 0.5 : 1} className="comment-actions"
            sx={richMode ? { opacity: 0.45, transition: 'opacity 0.14s', mt: 0.5 } : undefined}
          >
            {!disabled && (
              richMode ? (
                <Button size="small" color="inherit" startIcon={<ReplyIcon fontSize="small" />} onClick={() => setReplying((r) => !r)}>Reply</Button>
              ) : (
                <Button size="small" startIcon={<ReplyIcon fontSize="small" />} onClick={() => setReplying((r) => !r)}>Reply</Button>
              )
            )}
            {canDelete && (
              richMode ? (
                <Button size="small" color="error" sx={{ ml: 'auto' }} startIcon={<DeleteOutlineIcon fontSize="small" />} onClick={handleDeleteClick}>
                  Delete
                </Button>
              ) : (
                <IconButton size="small" aria-label="Delete comment" onClick={handleDeleteClick}><DeleteOutlineIcon fontSize="small" /></IconButton>
              )
            )}
          </Stack>

          <ConfirmDialog
            open={confirmOpen} title="Delete this comment?"
            description="This removes it from the discussion permanently — it can't be undone."
            confirmLabel="Delete" onConfirm={remove} onClose={() => setConfirmOpen(false)}
          />

          {replying && !disabled && (
            richMode ? (
              <Box sx={{ mt: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1 }}>
                <TextField
                  fullWidth multiline minRows={1} variant="standard" autoFocus
                  value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={handleReplyKeyDown}
                  placeholder="Write a reply..." inputProps={maxLength ? { maxLength } : undefined}
                  InputProps={{ disableUnderline: true }}
                />
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                  {allowAttachments && (
                    <IconButton size="small" onClick={() => replyFileInputRef.current?.click()} aria-label="Attach screenshot to reply">
                      <AttachFileIcon fontSize="small" />
                    </IconButton>
                  )}
                  {collapsibleComposer && <Typography variant="caption" color="text.secondary">Enter to send · Shift+Enter for a new line</Typography>}
                  <Box sx={{ flex: 1 }} />
                  <Button size="small" onClick={cancelReply} disabled={submitting}>Cancel</Button>
                  <Button size="small" variant="contained" disabled={submitting || !canSubmitReply} onClick={submitReply}>Send</Button>
                </Stack>
                {allowAttachments && replyFiles.length > 0 && (
                  <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
                    {replyFiles.map((f, i) => (
                      <Chip key={`${f.name}-${i}`} label={f.name} size="small" onDelete={() => removeReplyFile(i)} />
                    ))}
                  </Stack>
                )}
                {allowAttachments && (
                  <input ref={replyFileInputRef} type="file" accept="image/*" multiple hidden onChange={addReplyFiles} aria-label="Attach screenshot to reply" />
                )}
              </Box>
            ) : (
              <Box sx={{ mt: 1 }}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <TextField
                    size="small" fullWidth value={replyText} onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={handleReplyKeyDown}
                    placeholder="Write a reply..." inputProps={maxLength ? { maxLength } : undefined}
                    helperText={maxLength ? `${replyText.length}/${maxLength}` : undefined}
                    InputProps={allowAttachments ? {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => replyFileInputRef.current?.click()} aria-label="Attach screenshot to reply">
                            <AttachFileIcon fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      ),
                    } : undefined}
                  />
                  <Button size="small" variant="contained" disabled={submitting || !canSubmitReply} onClick={submitReply}>Send</Button>
                  <Button size="small" startIcon={<CloseIcon fontSize="small" />} disabled={submitting} onClick={cancelReply}>Cancel</Button>
                </Stack>
                {allowAttachments && (
                  <>
                    {replyFiles.length > 0 && (
                      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
                        {replyFiles.map((f, i) => (
                          <Chip key={`${f.name}-${i}`} label={f.name} size="small" onDelete={() => removeReplyFile(i)} />
                        ))}
                      </Stack>
                    )}
                    <input ref={replyFileInputRef} type="file" accept="image/*" multiple hidden onChange={addReplyFiles} aria-label="Attach screenshot to reply" />
                  </>
                )}
              </Box>
            )
          )}

          {/* Non-rich mode keeps the old unbounded recursive nesting untouched — only richMode
              flattens every descendant into this one rail (see flattenDescendants above). */}
          {!richMode && comment.replies?.length > 0 && (
            <Box sx={{ pl: 3, mt: 1, borderLeft: 2, borderColor: 'divider' }}>
              {comment.replies.map((reply) => (
                <CommentRow
                  key={reply.id} comment={reply} entityType={entityType} entityId={entityId}
                  onChanged={onChanged} onError={onError} currentUserId={currentUserId} canManageAll={canManageAll}
                  maxLength={maxLength} disabled={disabled} allowAttachments={allowAttachments}
                  richMode={richMode} showRoleBadges={showRoleBadges} attachmentViewer={attachmentViewer}
                  collapsibleComposer={collapsibleComposer} submitterId={submitterId} reviewChain={reviewChain}
                />
              ))}
            </Box>
          )}

          {richMode && flatReplies.length > 0 && (
            <Box sx={{ mt: 1.5, borderLeft: 2, borderColor: 'divider', pl: 1.75 }}>
              <Button
                size="small" color="inherit"
                startIcon={expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                onClick={() => setExpanded((v) => !v)}
              >
                {flatReplies.length} repl{flatReplies.length === 1 ? 'y' : 'ies'}
              </Button>
              {expanded && flatReplies.map(({ comment: r, answeringName: a }) => (
                <CommentRow
                  key={r.id} comment={r} answeringName={a} isFlatEntry
                  entityType={entityType} entityId={entityId}
                  onChanged={onChanged} onError={onError} currentUserId={currentUserId} canManageAll={canManageAll}
                  maxLength={maxLength} disabled={disabled} allowAttachments={allowAttachments}
                  richMode={richMode} showRoleBadges={showRoleBadges} attachmentViewer={attachmentViewer}
                  collapsibleComposer={collapsibleComposer} submitterId={submitterId} reviewChain={reviewChain}
                />
              ))}
            </Box>
          )}
        </Box>
      </Stack>
    </Box>
  );
}

/**
 * Shared across Applications, Suggestions, and Ideas — every new prop below defaults to the
 * exact current behaviour, so Applications and Suggestions (which never pass any of them) render
 * unchanged. `showRoleBadges`/`collapsibleComposer`/`attachmentViewer`/`sortToggle` are Ideas'
 * opt-in redesign; `richMode` (derived, not itself a prop) gates the general presentation
 * upgrades that don't have their own named flag — header count-across-replies, hover-reveal
 * actions, relative timestamps, the one-level-flattened reply rail, the frozen-state lock banner,
 * and the empty state — so turning on ANY one of the four still gets the coherent redesigned card
 * rather than a half-upgraded one, while a caller that passes none of them is guaranteed
 * byte-for-byte the old rendering for everything except the delete confirmation, which applies
 * unconditionally everywhere — deleting someone's comment without asking first isn't a look any
 * of the three callers should keep.
 */
export default function CommentThread({
  entityType, entityId, title = 'Comments', maxLength = DEFAULT_MAX_COMMENT_LENGTH,
  disabled = false, disabledReason = 'This has been decided — the discussion thread is now read-only.',
  disabledAt = null,
  newestFirst = false, composerAtTop = false, allowAttachments = false,
  showRoleBadges = false, collapsibleComposer = false, attachmentViewer = false, sortToggle = false,
  submitterId = null, reviewChain = null,
}) {
  const richMode = showRoleBadges || collapsibleComposer || attachmentViewer || sortToggle;
  const [rawComments, setRawComments] = useState([]);
  const [sortDesc, setSortDesc] = useState(newestFirst);
  const [newComment, setNewComment] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const fileInputRef = useRef(null);
  const user = useAppSelector((state) => state.auth.user);
  const permissions = user?.role?.permissions || [];
  const canManageAll = permissions.some((p) => p.resource === '*' && p.action === 'manage');
  const { showSuccess } = useToast();

  const load = async () => {
    try {
      const res = await commentsApi.list(entityType, entityId);
      setRawComments(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load comments');
    }
  };

  useEffect(() => { load(); }, [entityType, entityId]);

  // Sorting is a pure display-time transform over whatever's already loaded — the toggle re-orders
  // instantly with no re-fetch. Replies within a thread stay chronological regardless of direction.
  const comments = sortDesc ? [...rawComments].reverse() : rawComments;

  const addFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (picked.length) setFiles((prev) => [...prev, ...picked]);
  };

  const removeFile = (index) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const canSubmit = !!newComment.trim() || files.length > 0;

  const cancel = () => {
    setNewComment('');
    setFiles([]);
    if (collapsibleComposer) setComposerOpen(false);
  };

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await commentsApi.create({ entityType, entityId, body: newComment.trim() });
      const commentId = res.data.id;
      for (const file of files) {
        await attachmentsApi.upload(ATTACHMENT_ENTITY, commentId, file);
      }
      setNewComment('');
      setFiles([]);
      if (collapsibleComposer) setComposerOpen(false);
      await load();
      showSuccess('Comment posted');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  // Enter posts; Shift+Enter still inserts a newline (the standard chat-input convention) so a
  // multi-line comment is still possible without it submitting halfway through.
  const handleComposerKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  let composer;
  if (disabled) {
    composer = richMode ? (
      <Stack
        direction="row" alignItems="center" spacing={1.5}
        sx={(theme) => {
          const isDark = theme.palette.mode === 'dark';
          return {
            p: 1.5, borderRadius: 2,
            bgcolor: alpha(theme.palette.primary.main, isDark ? 0.16 : 0.08),
            border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.4 : 0.24)}`,
            color: isDark ? (theme.palette.primary.light || theme.palette.primary.main) : theme.palette.primary.dark,
          };
        }}
      >
        <LockIcon fontSize="small" />
        <Typography variant="body2" color="inherit">
          {disabledAt && <Box component="strong">Decided {dayjs(disabledAt).format('D MMM YYYY')}. </Box>}
          {disabledReason}
        </Typography>
      </Stack>
    ) : (
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {disabledReason}
      </Typography>
    );
  } else if (collapsibleComposer && !composerOpen) {
    composer = (
      <Box
        onClick={() => setComposerOpen(true)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, border: '1px solid', borderColor: 'divider',
          borderRadius: 2, px: 1.5, py: 1.1, color: 'text.secondary', cursor: 'text', bgcolor: 'action.hover',
          '&:hover': { borderColor: 'text.disabled' },
        }}
      >
        <ForumOutlinedIcon fontSize="small" />
        <Typography variant="body2">Add to the discussion…</Typography>
      </Box>
    );
  } else if (collapsibleComposer) {
    composer = (
      <Box sx={{ border: '1.5px solid', borderColor: 'primary.main', borderRadius: 2, p: 1.5 }}>
        <TextField
          fullWidth multiline minRows={2} variant="standard" autoFocus
          placeholder="Add context, ask a question, or record a concern for the reviewers…"
          value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={handleComposerKeyDown}
          inputProps={maxLength ? { maxLength } : undefined}
          InputProps={{ disableUnderline: true }}
        />
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          {allowAttachments && (
            <IconButton size="small" onClick={() => fileInputRef.current?.click()} aria-label="Attach screenshot">
              <AttachFileIcon fontSize="small" />
            </IconButton>
          )}
          <Typography variant="caption" color="text.secondary">Enter to post · Shift+Enter for a new line</Typography>
          {maxLength > 0 && (
            <Typography variant="caption" color={newComment.length > maxLength ? 'error' : 'text.secondary'}>
              {newComment.length}/{maxLength}
            </Typography>
          )}
          <Box sx={{ flex: 1 }} />
          <Button size="small" onClick={cancel} disabled={submitting}>Cancel</Button>
          <Button size="small" variant="contained" disabled={submitting || !canSubmit} onClick={submit}>
            {submitting ? 'Posting...' : 'Post'}
          </Button>
        </Stack>
        {allowAttachments && files.length > 0 && (
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
            {files.map((f, i) => (
              <Chip key={`${f.name}-${i}`} label={f.name} size="small" onDelete={() => removeFile(i)} />
            ))}
          </Stack>
        )}
        {allowAttachments && (
          <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={addFiles} aria-label="Attach screenshot" />
        )}
      </Box>
    );
  } else {
    composer = (
      <Box>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <TextField
            size="small" fullWidth multiline minRows={2}
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleComposerKeyDown}
            inputProps={maxLength ? { maxLength } : undefined}
            helperText={maxLength ? `${newComment.length}/${maxLength}` : undefined}
            InputProps={allowAttachments ? {
              endAdornment: (
                <InputAdornment position="end" sx={{ alignSelf: 'flex-end', mb: 0.5 }}>
                  <IconButton size="small" onClick={() => fileInputRef.current?.click()} aria-label="Attach screenshot">
                    <AttachFileIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            } : undefined}
            sx={allowAttachments ? { '& .MuiOutlinedInput-root': { alignItems: 'flex-end' } } : undefined}
          />
          <Button variant="contained" disabled={submitting || !canSubmit} onClick={submit}>
            {submitting ? 'Posting...' : 'Post'}
          </Button>
          {canSubmit && (
            <Button startIcon={<CloseIcon fontSize="small" />} disabled={submitting} onClick={cancel}>Cancel</Button>
          )}
        </Stack>
        {allowAttachments && (
          <>
            {files.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
                {files.map((f, i) => (
                  <Chip key={`${f.name}-${i}`} label={f.name} size="small" onDelete={() => removeFile(i)} />
                ))}
              </Stack>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={addFiles} aria-label="Attach screenshot" />
          </>
        )}
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" fontWeight={700}>
          {title} ({richMode ? countAll(rawComments) : rawComments.length})
        </Typography>
        <Box sx={{ flex: 1 }} />
        {sortToggle && (
          <Button size="small" variant="outlined" startIcon={<SwapVertIcon fontSize="small" />} onClick={() => setSortDesc((d) => !d)}>
            {sortDesc ? 'Newest' : 'Oldest'}
          </Button>
        )}
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* composerAtTop pairs with newestFirst — the newest comment lands right where the compose
          box already is, instead of appearing at the top of the list while typed at the bottom. */}
      {composerAtTop && <Box sx={{ mb: comments.length > 0 ? 2 : 1 }}>{composer}</Box>}

      {richMode && rawComments.length === 0 && !disabled && (
        <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
          <ForumOutlinedIcon sx={{ fontSize: 30, color: 'text.disabled' }} />
          <Typography variant="body2" fontWeight={600} color="text.secondary" sx={{ mt: 1 }}>No discussion yet</Typography>
          <Typography variant="body2" color="text.secondary">Ask a question or add context the reviewers will need.</Typography>
        </Box>
      )}

      <Box sx={richMode && disabled ? { opacity: 0.72 } : undefined}>
        {comments.map((c) => (
          <CommentRow
            key={c.id} comment={c} entityType={entityType} entityId={entityId}
            onChanged={load} onError={setError} currentUserId={user?.id} canManageAll={canManageAll}
            maxLength={maxLength} disabled={disabled} allowAttachments={allowAttachments}
            richMode={richMode} showRoleBadges={showRoleBadges} attachmentViewer={attachmentViewer}
            collapsibleComposer={collapsibleComposer} submitterId={submitterId} reviewChain={reviewChain}
          />
        ))}
      </Box>

      {!composerAtTop && <Box sx={{ mt: comments.length > 0 ? 2 : 1 }}>{composer}</Box>}
    </Box>
  );
}

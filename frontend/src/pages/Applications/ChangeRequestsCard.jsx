import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import dayjs from 'dayjs';
import { changeRequestsApi } from '../../services/domains';
import { useAppSelector } from '../../app/hooks';
import useToast from '../../hooks/useToast';
import usePermission from '../../routes/usePermission';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { LoadingBlock, ErrorBlock } from '../../components/common/AsyncState';
import { deriveStatusChip } from '../../utils/changeRequestStatus';

const MAX_VISIBLE = 5;

function ChangeRequestRow({ cr, canDelete, onDelete, onClick }) {
  const chip = deriveStatusChip(cr);
  return (
    <Box
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      }}
      sx={{
        py: 1.5, px: 1.5, cursor: 'pointer',
        border: 1, borderColor: 'divider', borderRadius: 1,
        '&:hover': { bgcolor: 'action.hover' },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '-2px' },
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center">
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>{cr.title}</Typography>
          {cr.description && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
                overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {cr.description}
            </Typography>
          )}
        </Box>
        <Stack alignItems="flex-end" spacing={0.5} sx={{ flexShrink: 0 }}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <StatusBadge color={chip.color} label={chip.label} />
            {canDelete && (
              <IconButton
                size="small"
                aria-label={`Delete ${cr.title}`}
                onClick={(e) => { e.stopPropagation(); onDelete(cr); }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {cr.requester?.name || 'Unknown user'} · {dayjs(cr.createdAt).format('MMM D, YYYY')}
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}

/**
 * Dedicated to change requests — deliberately NOT built on SubResourceTab.jsx, which Known Issues
 * also renders through and which has no notion of a delivery pipeline, a status chip derived from
 * more than one field, or a capped/"show all" list. `canCreate` stays false here; there is no
 * create-form work in this pass (see the project report — the collapsed single-field form is
 * being redesigned separately, not rebuilt as-is).
 */
export default function ChangeRequestsCard({ applicationId }) {
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const isSuperAdmin = usePermission('*', 'manage');
  const hasDeleteRole = usePermission('change_requests', 'delete');
  const { showSuccess, showError } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await changeRequestsApi.list(applicationId, { limit: 100 });
      setRows(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load change requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [applicationId]);

  // A bin that returns 400 (terminal status) or 403 (not the requester/a super-admin) is worse
  // than no bin at all — only ever shown when the click would actually succeed.
  const canDeleteRecord = (cr) => {
    if (!hasDeleteRole) return false;
    if (cr.status === 'implemented' || cr.status === 'rejected') return false;
    return isSuperAdmin || cr.requestedBy === user?.id;
  };

  const handleDelete = async () => {
    try {
      await changeRequestsApi.remove(applicationId, deleting.id);
      showSuccess('Change request deleted');
      setDeleting(null);
      await load();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to delete — please try again');
    }
  };

  const inProgressCount = rows.filter((cr) => (cr.stages || []).some((s) => s.status === 'in_progress')).length;
  const visible = showAll ? rows : rows.slice(0, MAX_VISIBLE);

  return (
    <Box>
      <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" fontWeight={700}>Change Requests</Typography>
        {rows.length > 0 && (
          <Typography variant="caption" color="text.secondary">
            {rows.length}{inProgressCount > 0 ? ` · ${inProgressCount} in progress` : ''}
          </Typography>
        )}
      </Stack>

      {loading ? (
        <LoadingBlock minHeight="80px" />
      ) : error ? (
        <ErrorBlock message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 3, textAlign: 'center' }}>
          <Typography variant="body2" fontWeight={600}>No change requests yet</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Requests raised against this application will appear here.
          </Typography>
        </Box>
      ) : (
        <>
          <Stack spacing={1.5}>
            {visible.map((cr) => (
              <ChangeRequestRow
                key={cr.id}
                cr={cr}
                canDelete={canDeleteRecord(cr)}
                onDelete={setDeleting}
                onClick={() => navigate(`/applications/${applicationId}/change-requests/${cr.id}`)}
              />
            ))}
          </Stack>
          {rows.length > MAX_VISIBLE && (
            // Expands in place — every row is already fetched (up to 100), so no second request.
            <Typography
              variant="caption"
              color="primary"
              role="button"
              tabIndex={0}
              onClick={() => setShowAll((s) => !s)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowAll((s) => !s); }
              }}
              sx={{
                display: 'block', mt: 1, textAlign: 'right', cursor: 'pointer',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              {showAll ? 'Show fewer' : `Show all ${rows.length} →`}
            </Typography>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete this change request?"
        description={`This will permanently remove "${deleting?.title || ''}".`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </Box>
  );
}

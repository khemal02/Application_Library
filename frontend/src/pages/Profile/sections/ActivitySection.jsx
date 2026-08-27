import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import EditIcon from '@mui/icons-material/EditOutlined';
import AddIcon from '@mui/icons-material/AddOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import LockResetIcon from '@mui/icons-material/LockResetOutlined';
import HistoryIcon from '@mui/icons-material/HistoryOutlined';
import dayjs from 'dayjs';
import { profileApi } from '../../../services/domains';
import { ErrorBlock } from '../../../components/common/AsyncState';
import { getAuditEntityName } from '../../../utils/auditEntityName';
import humanize from '../../../utils/humanize';
import SectionCard from './SectionCard';

const ACTION_META = {
  login: { icon: LoginIcon, color: 'success', verb: 'Logged in' },
  logout: { icon: LogoutIcon, color: 'default', verb: 'Logged out' },
  create: { icon: AddIcon, color: 'success', verb: 'Created' },
  update: { icon: EditIcon, color: 'info', verb: 'Updated' },
  delete: { icon: DeleteIcon, color: 'error', verb: 'Deleted' },
};

function activityTitle(log) {
  const meta = ACTION_META[log.action] || { verb: humanize(log.action) };
  if (log.action === 'login' || log.action === 'logout') return meta.verb;
  if (log.entityType === 'password') return 'Changed password';
  if (log.entityType === 'profile') return 'Updated profile';
  return `${meta.verb} ${humanize(log.entityType).toLowerCase()}`;
}

function ActivityRow({ log }) {
  const meta = ACTION_META[log.action] || { icon: HistoryIcon, color: 'default' };
  const Icon = log.entityType === 'password' ? LockResetIcon : (meta.icon || HistoryIcon);
  const entityName = getAuditEntityName(log);

  return (
    <Box sx={{ display: 'flex', gap: 2, py: 1.75 }}>
      <Avatar sx={{ width: 36, height: 36, bgcolor: `${meta.color}.main`, opacity: 0.9 }}>
        <Icon fontSize="small" />
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600}>{activityTitle(log)}</Typography>
        {entityName && <Typography variant="body2" color="text.secondary" noWrap>{entityName}</Typography>}
        <Typography variant="caption" color="text.secondary">
          {dayjs(log.createdAt).format('MMM D, YYYY')} at {dayjs(log.createdAt).format('HH:mm')}
        </Typography>
      </Box>
    </Box>
  );
}

function ActivitySkeleton() {
  return (
    <Stack divider={<Divider />}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 2, py: 1.75 }}>
          <Skeleton variant="circular" width={36} height={36} />
          <Box sx={{ flex: 1 }}>
            <Skeleton width="40%" />
            <Skeleton width="60%" />
            <Skeleton width="25%" />
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

export default function ActivitySection() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const load = async (pageNum) => {
    try {
      const res = await profileApi.getActivity({ page: pageNum, limit: 10 });
      setLogs((prev) => (pageNum === 1 ? res.data : [...prev, ...res.data]));
      setTotalPages(res.meta?.pagination?.totalPages || 1);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load activity');
    }
  };

  useEffect(() => {
    setLoading(true);
    load(1).finally(() => setLoading(false));
  }, []);

  const loadMore = async () => {
    setLoadingMore(true);
    await load(page + 1);
    setPage((p) => p + 1);
    setLoadingMore(false);
  };

  return (
    <SectionCard title="Activity">
      {loading && <ActivitySkeleton />}
      {!loading && error && <ErrorBlock message={error} onRetry={() => { setLoading(true); load(1).finally(() => setLoading(false)); }} />}
      {!loading && !error && logs.length === 0 && (
        <Typography variant="body2" color="text.secondary">No activity yet.</Typography>
      )}
      {!loading && !error && logs.length > 0 && (
        <>
          <Stack divider={<Divider />}>
            {logs.map((log) => <ActivityRow key={log.id} log={log} />)}
          </Stack>
          {page < totalPages && (
            <Button sx={{ mt: 2 }} disabled={loadingMore} onClick={loadMore} fullWidth>
              {loadingMore ? 'Loading…' : 'Load More'}
            </Button>
          )}
        </>
      )}
    </SectionCard>
  );
}

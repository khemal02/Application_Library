import { useEffect, useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import NotificationsIcon from '@mui/icons-material/NotificationsOutlined';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { fetchUnreadCount } from '../../features/notifications/notificationsSlice';
import { notificationsApi } from '../../services/domains';

export default function NotificationPanel() {
  const dispatch = useAppDispatch();
  const unreadCount = useAppSelector((state) => state.notifications.unreadCount);
  const [anchorEl, setAnchorEl] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    dispatch(fetchUnreadCount());
    const interval = setInterval(() => dispatch(fetchUnreadCount()), 30000);
    return () => clearInterval(interval);
  }, [dispatch]);

  const openMenu = async (event) => {
    setAnchorEl(event.currentTarget);
    setLoading(true);
    try {
      const res = await notificationsApi.list({ limit: 8 });
      setItems(res.data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = async (notification) => {
    setAnchorEl(null);
    try {
      await notificationsApi.markRead(notification.id);
      dispatch(fetchUnreadCount());
    } finally {
      if (notification.link) navigate(notification.link);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      dispatch(fetchUnreadCount());
    } finally {
      setAnchorEl(null);
    }
  };

  return (
    <>
      <IconButton color="inherit" aria-label="Notifications" onClick={openMenu}>
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)} PaperProps={{ sx: { width: 360 } }}>
        <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" fontWeight={700}>Notifications</Typography>
          <Button size="small" onClick={handleMarkAllRead}>Mark all read</Button>
        </Box>
        <Divider />
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={20} /></Box>
        )}
        {!loading && items.length === 0 && (
          <MenuItem disabled>No notifications yet</MenuItem>
        )}
        {!loading && items.map((n) => (
          <MenuItem key={n.id} onClick={() => handleItemClick(n)} sx={{ whiteSpace: 'normal', opacity: n.isRead ? 0.6 : 1 }}>
            <Box>
              <Typography variant="body2" fontWeight={600}>{n.title}</Typography>
              <Typography variant="caption" color="text.secondary" display="block">{n.message}</Typography>
              <Typography variant="caption" color="text.disabled">{dayjs(n.createdAt).fromNow?.() || dayjs(n.createdAt).format('MMM D, HH:mm')}</Typography>
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

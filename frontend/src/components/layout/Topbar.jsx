import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LogoutIcon from '@mui/icons-material/Logout';
import { alpha } from '@mui/material/styles';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { logout } from '../../features/auth/authSlice';
import { authApi } from '../../services/domains';
import initials from '../../utils/initials';
import NotificationPanel from './NotificationPanel';
import Breadcrumb from './Breadcrumb';

export default function Topbar() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const pageMeta = useAppSelector((state) => state.ui.pageMeta);
  const [anchorEl, setAnchorEl] = useState(null);

  // Best-effort — the server-side session is revoked when this succeeds, but a network hiccup
  // shouldn't trap the user in a logged-in-looking UI with a token the client has already forgotten.
  const handleLogout = () => {
    setAnchorEl(null);
    authApi.logout().catch(() => {});
    dispatch(logout());
    navigate('/login');
  };

  return (
    <AppBar
      position="sticky"
      color="default"
      elevation={0}
      sx={{
        top: 0,
        zIndex: (t) => t.zIndex.appBar,
        bgcolor: '#fff',
      }}
    >
      <Toolbar sx={{ gap: 2.5, minHeight: 64, px: { xs: 2, sm: '30px' } }}>
        <Stack direction="row" alignItems="center" spacing={1.75} sx={{ minWidth: 0, overflow: 'hidden' }}>
          <Box sx={{ flexShrink: 0 }}><Breadcrumb /></Box>

          {/* The current top-level page's own title + subtitle — only a list page (Dashboard,
              Ideas, ...) ever sets these (see usePageMeta); a detail page leaves them empty and
              its Breadcrumb pill above carries the full trail instead. */}
          {pageMeta.title && (
            <Box sx={{ minWidth: 0 }}>
              <Typography fontWeight={800} noWrap sx={{ fontSize: 19, lineHeight: 1.25 }}>{pageMeta.title}</Typography>
              {pageMeta.subtitle && (
                <Typography color="text.secondary" noWrap sx={{ fontSize: 12.5, display: 'block' }}>{pageMeta.subtitle}</Typography>
              )}
            </Box>
          )}

          {user?.role?.label && (
            <Chip
              icon={<WorkOutlineIcon />}
              label={user.role.label.toUpperCase()}
              size="small"
              sx={{
                flexShrink: 0,
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: 0.4,
                bgcolor: '#EAF2FE',
                color: '#1D4ED8',
                '& .MuiChip-icon': { color: '#1D4ED8' },
              }}
            />
          )}
        </Stack>

        <Box sx={{ flexGrow: 1 }} />
        <NotificationPanel />
        <IconButton aria-label="Account menu" onClick={(e) => setAnchorEl(e.currentTarget)}>
          <Avatar sx={{ width: 32, height: 32, fontSize: '13px', fontWeight: 700, bgcolor: 'primary.dark', color: '#fff' }} src={user?.avatarUrl || undefined}>
            {initials(user?.name)}
          </Avatar>
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          open={!!anchorEl}
          onClose={() => setAnchorEl(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{ sx: { minWidth: 280, mt: 1, overflow: 'visible' } }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.75 }}>
            <Avatar sx={{ width: 44, height: 44, fontSize: '16px', bgcolor: 'primary.dark', color: '#fff', fontWeight: 700 }} src={user?.avatarUrl || undefined}>
              {initials(user?.name)}
            </Avatar>
            <Box sx={{ overflow: 'hidden' }}>
              <Typography variant="body2" fontWeight={700} noWrap>{user?.name}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{user?.email}</Typography>
              {user?.role?.label && (
                <Chip
                  label={user.role.label.toUpperCase()}
                  size="small"
                  sx={{
                    mt: 0.5, height: 20, fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
                    bgcolor: '#EAF2FE',
                    color: '#1D4ED8',
                  }}
                />
              )}
            </Box>
          </Box>
          <Divider />
          <MenuItem onClick={() => { setAnchorEl(null); navigate('/profile'); }} sx={{ py: 1.25 }}>
            <ListItemIcon><PersonOutlineIcon fontSize="small" /></ListItemIcon>
            Profile
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={handleLogout}
            sx={{
              py: 1.25,
              color: 'error.main',
              bgcolor: (t) => alpha(t.palette.error.main, t.palette.mode === 'dark' ? 0.18 : 0.08),
              '&:hover': { bgcolor: (t) => alpha(t.palette.error.main, t.palette.mode === 'dark' ? 0.28 : 0.14) },
            }}
          >
            <ListItemIcon><LogoutIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
            Logout
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LogoutIcon from '@mui/icons-material/Logout';
import { alpha, ThemeProvider } from '@mui/material/styles';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { toggleThemeMode } from '../../features/ui/uiSlice';
import { logout } from '../../features/auth/authSlice';
import { authApi } from '../../services/domains';
import { getTheme } from '../../theme/theme';
import avatarColor from '../../utils/avatarColor';
import roleColor from '../../utils/roleColor';
import NotificationPanel from './NotificationPanel';
import GlobalSearchBox from './GlobalSearchBox';
import Breadcrumb from './Breadcrumb';

export default function Topbar() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const themeMode = useAppSelector((state) => state.ui.themeMode);
  const user = useAppSelector((state) => state.auth.user);
  const [anchorEl, setAnchorEl] = useState(null);
  // The topbar always renders in the light theme regardless of the app's dark-mode toggle, so its
  // background stays pure white and every child (breadcrumb, search, menus...) gets correct
  // light-mode contrast instead of resolving against whichever mode is currently active.
  const topbarTheme = useMemo(() => getTheme('light'), []);

  // Best-effort — the server-side session is revoked when this succeeds, but a network hiccup
  // shouldn't trap the user in a logged-in-looking UI with a token the client has already forgotten.
  const handleLogout = () => {
    setAnchorEl(null);
    authApi.logout().catch(() => {});
    dispatch(logout());
    navigate('/login');
  };

  return (
    <ThemeProvider theme={topbarTheme}>
      <AppBar
        position="fixed"
        color="default"
        elevation={0}
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          bgcolor: '#fff',
        }}
      >
      <Toolbar sx={{ gap: 2, minHeight: 64 }}>
        {/* Brand mark — always visible at the left of the topbar, regardless of sidebar state */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1 }}>
          <Avatar
            variant="rounded"
            sx={{ width: 30, height: 30, borderRadius: 1.5, background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)' }}
          >
            <HubOutlinedIcon sx={{ fontSize: 16 }} />
          </Avatar>
          <Typography variant="subtitle1" fontWeight={800} letterSpacing={0.3}>ALMS</Typography>
          <Divider orientation="vertical" flexItem sx={{ mx: 1, my: 1 }} />
        </Box>

        <Box sx={{ flexGrow: 0, minWidth: 160 }}><Breadcrumb /></Box>

        {user?.role?.label && (
          <Chip
            icon={<BadgeOutlinedIcon />}
            label={user.role.label.toUpperCase()}
            size="small"
            sx={{
              fontWeight: 700,
              letterSpacing: 0.4,
              bgcolor: roleColor(user.role.name),
              color: '#fff',
              '& .MuiChip-icon': { color: '#fff' },
            }}
          />
        )}

        <Box sx={{ flexGrow: 1 }} />
        <GlobalSearchBox />
        <IconButton aria-label="Toggle dark mode" onClick={() => dispatch(toggleThemeMode())}>
          {themeMode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
        </IconButton>
        <NotificationPanel />
        <IconButton aria-label="Account menu" onClick={(e) => setAnchorEl(e.currentTarget)}>
          <Avatar sx={{ width: 32, height: 32, bgcolor: avatarColor(user?.id || user?.name), color: '#fff' }} src={user?.avatarUrl || undefined}>
            {user?.name?.[0]}
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
            <Avatar sx={{ width: 44, height: 44, bgcolor: avatarColor(user?.id || user?.name), color: '#fff', fontWeight: 700 }} src={user?.avatarUrl || undefined}>
              {user?.name?.[0]}
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
                    bgcolor: roleColor(user.role.name),
                    color: '#fff',
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
    </ThemeProvider>
  );
}

import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Collapse from '@mui/material/Collapse';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { toggleSidebar } from '../../features/ui/uiSlice';
import { logout } from '../../features/auth/authSlice';
import { authApi } from '../../services/domains';
import navConfig from './navConfig';
import { DRAWER_WIDTH, COLLAPSED_WIDTH } from './sidebarConstants';
import avatarColor from '../../utils/avatarColor';

const SKY_BLUE = '#0ea5e9';

// Sidebar sits on a solid sky-blue background, so every nav item needs an explicit
// white-based palette instead of the app's normal light/dark text colors.
const navSx = {
  root: { color: 'rgba(255,255,255,0.85)', mx: 1, borderRadius: 1.5 },
  active: { color: '#fff', bgcolor: 'rgba(255,255,255,0.16)', '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' } },
  hover: { '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } },
};

function ActiveRail() {
  return (
    <Box
      sx={{
        position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 3.5,
        borderRadius: '0 4px 4px 0',
        bgcolor: '#ffffff',
      }}
    />
  );
}

function NavEntry({ item, sidebarOpen, onExpandSidebar }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const Icon = item.icon;

  if (item.children) {
    const button = (
      <ListItemButton
        onClick={() => {
          if (!sidebarOpen) { onExpandSidebar(); setOpen(true); return; }
          setOpen((o) => !o);
        }}
        sx={{ ...navSx.root, ...navSx.hover, justifyContent: sidebarOpen ? 'flex-start' : 'center' }}
      >
        <ListItemIcon sx={{ color: 'inherit', minWidth: sidebarOpen ? 40 : 0, justifyContent: 'center' }}><Icon /></ListItemIcon>
        {sidebarOpen && <ListItemText primary={item.label} />}
        {sidebarOpen && (open ? <ExpandLess /> : <ExpandMore />)}
      </ListItemButton>
    );

    return (
      <>
        {sidebarOpen ? button : <Tooltip title={item.label} placement="right">{button}</Tooltip>}
        {sidebarOpen && (
          <Collapse in={open} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.children.map((child) => {
                const isChildActive = location.pathname === child.path;
                return (
                  <ListItemButton
                    key={child.path}
                    sx={{ pl: 6, position: 'relative', ...navSx.root, ...(isChildActive ? navSx.active : navSx.hover) }}
                    selected={isChildActive}
                    aria-current={isChildActive ? 'page' : undefined}
                    onClick={() => navigate(child.path)}
                  >
                    {isChildActive && <ActiveRail />}
                    <ListItemText
                      primary={child.label}
                      primaryTypographyProps={{ fontWeight: isChildActive ? 700 : 500 }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Collapse>
        )}
      </>
    );
  }

  const isActive = location.pathname === item.path;
  const button = (
    <ListItemButton
      selected={isActive}
      aria-current={isActive ? 'page' : undefined}
      onClick={() => navigate(item.path)}
      sx={{ position: 'relative', ...navSx.root, ...(isActive ? navSx.active : navSx.hover), justifyContent: sidebarOpen ? 'flex-start' : 'center' }}
    >
      {isActive && <ActiveRail />}
      <ListItemIcon sx={{ color: 'inherit', minWidth: sidebarOpen ? 40 : 0, justifyContent: 'center' }}><Icon /></ListItemIcon>
      {sidebarOpen && (
        <ListItemText
          primary={item.label}
          primaryTypographyProps={{ fontWeight: isActive ? 700 : 500 }}
        />
      )}
    </ListItemButton>
  );

  return sidebarOpen ? button : <Tooltip title={item.label} placement="right">{button}</Tooltip>;
}

export default function Sidebar({ open }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const permissions = useAppSelector((state) => state.auth.user?.role?.permissions || []);
  const hasAccess = (item) => {
    if (!item.resource) return true;
    return permissions.some(
      (p) => (p.resource === item.resource || p.resource === '*') && (p.action === item.action || p.action === 'manage'),
    );
  };

  const handleLogout = () => {
    authApi.logout().catch(() => {});
    dispatch(logout());
    navigate('/login');
  };

  return (
    <Drawer
      variant="persistent"
      open
      sx={{
        width: open ? DRAWER_WIDTH : COLLAPSED_WIDTH,
        flexShrink: 0,
        whiteSpace: 'nowrap',
        transition: (t) => t.transitions.create('width', { duration: t.transitions.duration.short }),
        [`& .MuiDrawer-paper`]: {
          width: open ? DRAWER_WIDTH : COLLAPSED_WIDTH,
          boxSizing: 'border-box',
          bgcolor: SKY_BLUE,
          border: 'none',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: (t) => t.transitions.create('width', { duration: t.transitions.duration.short }),
        },
      }}
    >
      {/* Spacer matching the fixed Topbar's height — the Topbar's own brand mark already spans
          the full page width above the sidebar, so this row is intentionally left empty. */}
      <Toolbar />
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.18)' }} />
      <List sx={{ pt: 1.5, flexGrow: 1 }}>
        {navConfig.filter(hasAccess).map((item) => (
          <NavEntry key={item.label} item={item} sidebarOpen={open} onExpandSidebar={() => dispatch(toggleSidebar())} />
        ))}
      </List>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.18)' }} />
      <Tooltip title={!open && user ? `${user.name} — ${user.role?.label || ''}` : ''} placement="right">
        <Box
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.25,
            justifyContent: open ? 'flex-start' : 'center',
            px: open ? 2 : 0, py: 1.5,
          }}
        >
          <Avatar sx={{ width: 36, height: 36, bgcolor: avatarColor(user?.id || user?.name), color: '#fff', fontWeight: 700, flexShrink: 0 }}>
            {user?.name?.[0]}
          </Avatar>
          {open && (
            <Box sx={{ overflow: 'hidden', minWidth: 0, flex: 1 }}>
              <Typography variant="body2" fontWeight={700} noWrap sx={{ color: '#fff' }}>{user?.name}</Typography>
              <Typography variant="caption" noWrap sx={{ color: 'rgba(255,255,255,0.75)' }}>{user?.role?.label}</Typography>
            </Box>
          )}
          {open && (
            <Tooltip title="Log out">
              <IconButton
                size="small"
                onClick={handleLogout}
                aria-label="Log out"
                sx={{ color: 'rgba(255,255,255,0.85)', flexShrink: 0, '&:hover': { bgcolor: 'rgba(255,255,255,0.12)', color: '#fff' } }}
              >
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Tooltip>
    </Drawer>
  );
}

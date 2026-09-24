import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Collapse from '@mui/material/Collapse';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { toggleSidebar } from '../../features/ui/uiSlice';
import navConfig from './navConfig';
import { DRAWER_WIDTH, COLLAPSED_WIDTH } from './sidebarConstants';
import initials from '../../utils/initials';
import NotificationPanel from './NotificationPanel';

// Approved navy/blue design system (see theme.js's own header comment on where this came from).
const NAVY = '#0B1E3D';

// Sidebar sits on a solid navy background, so every nav item needs an explicit palette instead of
// the app's normal light/dark text colors. Active reads as a solid blue pill (not a rail/tint
// anymore) — same "pill" language the rest of this restyle uses for buttons/segmented controls.
// The active fill is scoped to `&.Mui-selected` (rather than a plain top-level bgcolor) so it
// matches theme.js's own `MuiListItemButton`/`.Mui-selected` override at EQUAL selector
// specificity (both are a one-class + `.Mui-selected` compound) — a plain bgcolor here loses that
// specificity fight and silently renders the theme's translucent selected-tint instead of this
// solid pill.
const navSx = {
  root: { color: '#D7E2F5', mx: 1, borderRadius: '9px' },
  active: {
    color: '#fff',
    '&.Mui-selected': { bgcolor: '#2563EB', color: '#fff' },
    '&.Mui-selected:hover': { bgcolor: '#2563EB' },
  },
  hover: { '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' } },
};
const navIconColor = (isActive) => (isActive ? '#fff' : '#8FB3E8');

function NavEntry({ item, sidebarOpen, onExpandSidebar, hasAccess }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const Icon = item.icon;

  if (item.children) {
    const visibleChildren = item.children.filter(hasAccess);
    if (visibleChildren.length === 0) return null;
    const button = (
      <ListItemButton
        onClick={() => {
          if (!sidebarOpen) { onExpandSidebar(); setOpen(true); return; }
          setOpen((o) => !o);
        }}
        sx={{ ...navSx.root, ...navSx.hover, justifyContent: sidebarOpen ? 'flex-start' : 'center' }}
      >
        <ListItemIcon sx={{ color: navIconColor(false), minWidth: sidebarOpen ? 40 : 0, justifyContent: 'center' }}><Icon /></ListItemIcon>
        {sidebarOpen && <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '13.8px', fontWeight: 600 }} />}
        {sidebarOpen && (open ? <ExpandLess /> : <ExpandMore />)}
      </ListItemButton>
    );

    return (
      <>
        {sidebarOpen ? button : <Tooltip title={item.label} placement="right">{button}</Tooltip>}
        {sidebarOpen && (
          <Collapse in={open} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {visibleChildren.map((child) => {
                const isChildActive = location.pathname === child.path;
                return (
                  <ListItemButton
                    key={child.path}
                    sx={{ pl: 6, ...navSx.root, ...(isChildActive ? navSx.active : navSx.hover) }}
                    selected={isChildActive}
                    aria-current={isChildActive ? 'page' : undefined}
                    onClick={() => navigate(child.path)}
                  >
                    <ListItemText
                      primary={child.label}
                      primaryTypographyProps={{ fontSize: '13.8px', fontWeight: 600 }}
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

  // Most items match their own path exactly; the merged Ideas page also renders at
  // /feature-requests (its other original route, kept for old links/bookmarks — see
  // AppRoutes.jsx) via `item.activePaths`, so the sidebar still highlights "Ideas" there too.
  const isActive = item.activePaths ? item.activePaths.includes(location.pathname) : location.pathname === item.path;
  const button = (
    <ListItemButton
      selected={isActive}
      aria-current={isActive ? 'page' : undefined}
      onClick={() => navigate(item.path)}
      sx={{ ...navSx.root, ...(isActive ? navSx.active : navSx.hover), justifyContent: sidebarOpen ? 'flex-start' : 'center' }}
    >
      <ListItemIcon sx={{ color: navIconColor(isActive), minWidth: sidebarOpen ? 40 : 0, justifyContent: 'center' }}><Icon /></ListItemIcon>
      {sidebarOpen && (
        <ListItemText
          primary={item.label}
          primaryTypographyProps={{ fontSize: '13.8px', fontWeight: 600 }}
        />
      )}
    </ListItemButton>
  );

  return sidebarOpen ? button : <Tooltip title={item.label} placement="right">{button}</Tooltip>;
}

export default function Sidebar({ open }) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const permissions = useAppSelector((state) => state.auth.user?.role?.permissions || []);
  const hasAccess = (item) => {
    if (!item.resource) return true;
    return permissions.some(
      (p) => (p.resource === item.resource || p.resource === '*') && (p.action === item.action || p.action === 'manage'),
    );
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
          bgcolor: NAVY,
          border: 'none',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: (t) => t.transitions.create('width', { duration: t.transitions.duration.short }),
        },
      }}
    >
      {/* Brand mark — lives here now, not in the Topbar (which starts at the sidebar's right edge
          per the approved reference), so the sidebar reads as its own self-contained column. */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: open ? 2 : 0, py: 2, justifyContent: open ? 'flex-start' : 'center' }}>
        <Avatar sx={{ width: 34, height: 34, bgcolor: '#EAF2FE', color: '#2563EB', flexShrink: 0 }}>
          <LayersOutlinedIcon sx={{ fontSize: 18 }} />
        </Avatar>
        {open && (
          <Box sx={{ overflow: 'hidden', minWidth: 0 }}>
            <Typography noWrap sx={{ color: '#fff', fontSize: '16px', fontWeight: 800, letterSpacing: '.04em', lineHeight: 1.2 }}>ALMS</Typography>
            <Typography noWrap sx={{ color: '#8FB3E8', fontSize: '10.5px', display: 'block', lineHeight: 1.3, mt: '1px' }}>Application Library</Typography>
          </Box>
        )}
      </Box>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.18)' }} />
      <List sx={{ pt: 1.5, flexGrow: 1 }}>
        {navConfig.filter(hasAccess).map((item) => (
          <NavEntry key={item.label} item={item} sidebarOpen={open} onExpandSidebar={() => dispatch(toggleSidebar())} hasAccess={hasAccess} />
        ))}
      </List>
      <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', px: open ? 2.5 : 0, pt: 1.75, pb: 1.75 }}>
        <Box sx={{ display: 'flex', justifyContent: open ? 'flex-start' : 'center', pb: 1.5 }}>
          <NotificationPanel iconSx={{ color: '#AFC6EA', fontSize: 19 }} />
        </Box>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mx: open ? -2.5 : 0 }} />
        <Tooltip title={!open && user ? `${user.name} — ${user.role?.label || ''}` : ''} placement="right">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, justifyContent: open ? 'flex-start' : 'center', mt: 1.5 }}>
            <Avatar sx={{ width: 34, height: 34, fontSize: '13px', bgcolor: '#163565', color: '#fff', fontWeight: 700, flexShrink: 0 }}>
              {initials(user?.name)}
            </Avatar>
            {open && (
              <Box sx={{ overflow: 'hidden', minWidth: 0, flex: 1 }}>
                <Typography variant="body2" fontWeight={700} noWrap sx={{ color: '#fff' }}>{user?.name}</Typography>
                <Typography variant="caption" noWrap sx={{ color: '#7FB0EE', display: 'block' }}>{user?.role?.label}</Typography>
              </Box>
            )}
          </Box>
        </Tooltip>
      </Box>
    </Drawer>
  );
}

import DashboardIcon from '@mui/icons-material/DashboardOutlined';
import AppsIcon from '@mui/icons-material/AppsOutlined';
import LightbulbIcon from '@mui/icons-material/LightbulbOutlined';
import TrackChangesIcon from '@mui/icons-material/TrackChangesOutlined';
import PeopleIcon from '@mui/icons-material/PeopleOutline';
import AdminIcon from '@mui/icons-material/AdminPanelSettingsOutlined';

const navConfig = [
  { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
  // New Ideas and Modify Current Application were merged into one list screen — one nav entry
  // now, same as every other single-page module. Gated on 'ideas:read' (the route it points to,
  // /ideas, carries that same guard) — 'feature_requests' is still its own separate RBAC resource
  // underneath, but no role seeded today holds one without the other, and the page itself further
  // narrows what it shows per-viewer via its own real per-resource checks (see
  // IdeasAndFeatureRequestsListPage.jsx).
  {
    label: 'Ideas', path: '/ideas', icon: LightbulbIcon, resource: 'ideas', action: 'read',
    // Rendered at /feature-requests too (the old "Modify Current Application" route, kept for
    // backward compatibility) — activePaths keeps the sidebar highlighted on either.
    activePaths: ['/ideas', '/feature-requests'],
  },
  {
    label: 'Application Tracking', path: '/application-tracking', icon: TrackChangesIcon,
    resource: 'application_tracks', action: 'read',
  },
  { label: 'Applications', path: '/applications', icon: AppsIcon },
  {
    label: 'Administration', icon: AdminIcon, resource: 'users', action: 'read',
    children: [
      { label: 'Users', path: '/admin/users' },
      { label: 'Roles & Permissions', path: '/admin/roles' },
      { label: 'Departments', path: '/admin/departments' },
    ],
  },
];

export default navConfig;

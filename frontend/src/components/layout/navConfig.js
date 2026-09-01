import DashboardIcon from '@mui/icons-material/DashboardOutlined';
import AppsIcon from '@mui/icons-material/AppsOutlined';
import LightbulbIcon from '@mui/icons-material/LightbulbOutlined';
import RateReviewIcon from '@mui/icons-material/RateReviewOutlined';
import PeopleIcon from '@mui/icons-material/PeopleOutline';
import AdminIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import HistoryIcon from '@mui/icons-material/HistoryOutlined';

const navConfig = [
  { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
  { label: 'Applications', path: '/applications', icon: AppsIcon },
  {
    label: 'Ideas', icon: LightbulbIcon,
    // No resource/action on the group itself — New Ideas and Modify Current Application are
    // separate RBAC resources ('ideas'/'feature_requests') now, gated per-child below, since the
    // split into fully independent modules.
    children: [
      { label: 'New Ideas', path: '/ideas', resource: 'ideas', action: 'read' },
      { label: 'Modify Current Application', path: '/feature-requests', resource: 'feature_requests', action: 'read' },
    ],
  },
  { label: 'Suggestions', path: '/suggestions', icon: RateReviewIcon },
  {
    label: 'Administration', icon: AdminIcon, resource: 'users', action: 'read',
    children: [
      { label: 'Users', path: '/admin/users' },
      { label: 'Roles & Permissions', path: '/admin/roles' },
      { label: 'Departments', path: '/admin/departments' },
    ],
  },
  { label: 'Audit Logs', path: '/admin/audit-logs', icon: HistoryIcon, resource: 'audit_logs', action: 'read' },
];

export default navConfig;

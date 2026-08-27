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
    children: [
      { label: 'New Ideas', path: '/ideas' },
      { label: 'Modify Current Application', path: '/feature-requests' },
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

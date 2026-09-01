import { Link, useLocation } from 'react-router-dom';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Typography from '@mui/material/Typography';
import { useAppSelector } from '../../app/hooks';

const LABELS = {
  applications: 'Applications', ideas: 'Ideas', suggestions: 'Suggestions',
  'feature-requests': 'Modify Current Application',
  admin: 'Administration', users: 'Users', roles: 'Roles & Permissions',
  departments: 'Departments', 'audit-logs': 'Audit Logs', profile: 'Profile',
  new: 'New', settings: 'Settings', stages: 'Stages', 'change-requests': 'Change Requests',
};

export default function Breadcrumb() {
  const location = useLocation();
  const entityLabels = useAppSelector((state) => state.ui.entityLabels);
  const segments = location.pathname.split('/').filter(Boolean);

  if (segments.length === 0) return <Typography variant="body2" color="text.secondary">Applications</Typography>;

  return (
    <Breadcrumbs sx={{ fontSize: 14 }}>
      <Typography component={Link} to="/dashboard" variant="body2" color="text.secondary" sx={{ textDecoration: 'none' }}>
        Dashboard
      </Typography>
      {segments.map((seg, idx) => {
        const path = `/${segments.slice(0, idx + 1).join('/')}`;
        const isLast = idx === segments.length - 1;
        const label = entityLabels[path] || LABELS[seg] || (seg.length > 20 ? `${seg.slice(0, 8)}...` : seg);
        return isLast ? (
          <Typography key={path} variant="body2" color="text.primary" fontWeight={600} noWrap sx={{ maxWidth: 320 }}>{label}</Typography>
        ) : (
          <Typography key={path} component={Link} to={path} variant="body2" color="text.secondary" sx={{ textDecoration: 'none' }}>
            {label}
          </Typography>
        );
      })}
    </Breadcrumbs>
  );
}

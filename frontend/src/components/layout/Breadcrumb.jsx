import { useLocation } from 'react-router-dom';
import Chip from '@mui/material/Chip';

const LABELS = {
  applications: 'Applications', ideas: 'Ideas',
  // Both routes render the same merged Ideas/Feature-Requests list page now — same breadcrumb
  // label for either entry point, so it matches whichever one the viewer actually landed on.
  'feature-requests': 'Ideas',
  admin: 'Administration', users: 'Users', roles: 'Roles & Permissions',
  departments: 'Departments', profile: 'Profile',
  new: 'New', settings: 'Settings', stages: 'Stages', 'change-requests': 'Change Requests',
  'my-stages': 'My Stages', 'application-tracking': 'Application Tracking',
  'idea-prioritization': 'Idea Prioritization',
};

const pillSx = {
  fontSize: 12, fontWeight: 600, bgcolor: '#F1F3F6', color: '#4B5563',
  borderRadius: '14px', height: 26, '& .MuiChip-label': { px: 1.375 },
};

// Always just the current module's own short label (e.g. "Ideas"), on a list page and every
// detail page underneath it alike — not a "Dashboard / Ideas / <item name>" trail. Every detail
// page already has its own dedicated Back button, so this never needs to double as navigation.
export default function Breadcrumb() {
  const location = useLocation();
  const [topSegment] = location.pathname.split('/').filter(Boolean);

  if (!topSegment) return <Chip label="Applications" sx={pillSx} />;

  const label = LABELS[topSegment] || (topSegment === 'dashboard' ? 'Dashboard' : topSegment);
  return <Chip label={label} sx={pillSx} />;
}

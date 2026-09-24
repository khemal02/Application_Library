import { useLocation } from 'react-router-dom';
import Chip from '@mui/material/Chip';
import { useAppSelector } from '../../app/hooks';

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

// A single static pill now, not a clickable trail (matches the approved reference exactly) —
// every detail page this could otherwise have linked back from already has its own dedicated
// Back button, so nothing here was the only way to navigate up.
const pillSx = {
  fontSize: 12, fontWeight: 600, bgcolor: '#F1F3F6', color: '#4B5563',
  borderRadius: '14px', height: 26, '& .MuiChip-label': { px: 1.375 },
};

export default function Breadcrumb() {
  const location = useLocation();
  const entityLabels = useAppSelector((state) => state.ui.entityLabels);
  const segments = location.pathname.split('/').filter(Boolean);

  if (segments.length === 0) return <Chip label="Applications" sx={pillSx} />;

  // A genuine top-level page (Dashboard, Ideas, Idea Prioritization, Application Tracking,
  // Applications — every real route this app has at depth 1) gets just its OWN short label, not
  // a "Dashboard / X" trail — the Topbar's own title/subtitle (see usePageMeta) carries the rest.
  // Anything deeper (a detail page, an admin sub-page, ...) gets the full trail instead, since
  // there's no separate title block for those to lean on.
  if (segments.length === 1) {
    const label = entityLabels[`/${segments[0]}`] || LABELS[segments[0]] || (segments[0] === 'dashboard' ? 'Dashboard' : segments[0]);
    return <Chip label={label} sx={pillSx} />;
  }

  const trail = ['Dashboard', ...segments.map((seg, idx) => {
    const path = `/${segments.slice(0, idx + 1).join('/')}`;
    return entityLabels[path] || LABELS[seg] || (seg.length > 20 ? `${seg.slice(0, 8)}...` : seg);
  })].join(' / ');

  return <Chip label={trail} sx={{ ...pillSx, maxWidth: 420, '& .MuiChip-label': { ...pillSx['& .MuiChip-label'], overflow: 'hidden', textOverflow: 'ellipsis' } }} />;
}

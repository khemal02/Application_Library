import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import humanize from '../../utils/humanize';

// Same semantic mapping as before (which status reads as success/warning/error/etc.) — only the
// rendering below changed, from solid Chip fills to soft enterprise-style tinted badges.
const COLOR_MAP = {
  // generic
  active: 'success', inactive: 'default', open: 'warning', resolved: 'success', monitoring: 'info', wont_fix: 'default',
  // applications
  planning: 'default', in_progress: 'info', completed: 'success', on_hold: 'warning', deprecated: 'default',
  // features / roadmap / timeline
  planned: 'default', blocked: 'error', proposed: 'default', done: 'success', upcoming: 'default', delayed: 'warning',
  // ideas — submitted/discussion/technical_review_1/technical_review_2/review/development_ready
  // are historical-only now (status_history rows from before the three-reviewer chain replaced
  // them), kept here only so old entries still render a color instead of falling back to default.
  submitted: 'info', discussion: 'warning', technical_review_1: 'warning', technical_review_2: 'warning',
  review: 'warning', under_review: 'warning', approved: 'success', rejected: 'error', development_ready: 'success',
  // suggestions
  technical_review: 'warning', assigned: 'info', implemented: 'success', closed: 'default',
  // priority / severity
  low: 'default', medium: 'info', high: 'warning', critical: 'error',
};

export default function StatusBadge({ value, size = 'small', label }) {
  const colorKey = COLOR_MAP[value] || 'default';

  return (
    <Chip
      size={size}
      label={label ?? humanize(value)}
      sx={(theme) => {
        const isDark = theme.palette.mode === 'dark';
        if (colorKey === 'default') {
          const neutral = isDark ? theme.palette.text.secondary : theme.palette.text.secondary;
          return {
            bgcolor: isDark ? alpha('#e2e8f0', 0.08) : alpha('#64748b', 0.1),
            color: neutral,
            border: 'none',
          };
        }
        const main = theme.palette[colorKey].main;
        return {
          bgcolor: alpha(main, isDark ? 0.2 : 0.12),
          color: isDark ? theme.palette[colorKey].light || main : main,
          border: 'none',
        };
      }}
    />
  );
}

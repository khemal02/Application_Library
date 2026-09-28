import Chip from '@mui/material/Chip';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import { alpha } from '@mui/material/styles';

// Same blue/orange pairing everywhere an idea/feature-request's type shows up — the Ideas list's
// Type column, its segmented control's dots, and both detail pages' own type badge beside
// "Submitted by". idea's blue already equals the theme's own primary (#2563EB) — no separate
// token needed. feature_request's orange is the approved reference's own distinct
// "feature-request accent" token (#C2570C), not the old warning color it used to borrow before
// the navy/blue restyle.
export const TYPE_META = {
  idea: { label: 'New Idea', color: '#2563EB', icon: LightbulbOutlinedIcon },
  feature_request: { label: 'Feature Request', color: '#C2570C', icon: BuildOutlinedIcon },
};

export default function TypeBadge({ type, sx }) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  return (
    <Chip
      size="small"
      icon={<Icon fontSize="small" />}
      label={meta.label}
      sx={{
        bgcolor: alpha(meta.color, 0.12), color: meta.color, border: 'none',
        fontSize: '11.6px', fontWeight: 700,
        '& .MuiChip-icon': { color: 'inherit' },
        ...sx,
      }}
    />
  );
}

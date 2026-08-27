// Fixed, semantic color per role (keyed by the role's stable `name`, not its display `label`) —
// distinct from avatarColor.js's per-user hash, since roles are a small fixed set worth giving
// deliberate meaning to rather than an arbitrary hash bucket.
const ROLE_COLORS = {
  admin: '#dc2626', // red — unrestricted system access
  ceo: '#b45309', // amber — executive
  manager: '#4f46e5', // indigo — org-wide management
  team_lead: '#0891b2', // cyan — team leadership
  employee: '#16a34a', // green — standard contributor
};

const DEFAULT_COLOR = '#64748b'; // slate — fallback for any role not in the map above

export default function roleColor(roleName) {
  return ROLE_COLORS[roleName] || DEFAULT_COLOR;
}

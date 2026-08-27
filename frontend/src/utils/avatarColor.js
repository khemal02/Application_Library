// Distinct, mid-saturation hues that read well with white text in both light and dark mode —
// deliberately keeps clear of the app's primary indigo, secondary sky-blue, and status-badge red
// so per-user avatar colors never get mistaken for brand or state cues.
const PALETTE = [
  '#f97316', '#f59e0b', '#84cc16', '#10b981', '#14b8a6',
  '#8b5cf6', '#ec4899', '#f43f5e', '#0891b2', '#a855f7',
];

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Deterministic avatar background color for a given seed (user id, falling back to name) — the same person always gets the same color everywhere. */
export default function avatarColor(seed) {
  if (!seed) return undefined;
  return PALETTE[hashString(String(seed)) % PALETTE.length];
}

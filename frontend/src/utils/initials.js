/** Up to two letters — one per word, uppercased (e.g. "Ethan Employee" -> "EE") — matching the
 * approved reference's avatar convention (sidebar, topbar, and list-row avatars all use this, not
 * just a single first letter). */
export default function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

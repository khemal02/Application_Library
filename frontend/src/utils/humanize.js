/** 'development_ready' -> 'Development Ready' */
export default function humanize(value) {
  if (!value) return '';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

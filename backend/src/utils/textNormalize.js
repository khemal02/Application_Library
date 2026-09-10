/**
 * Capitalizes only the first character of an already-trimmed string, leaving the rest untouched
 * (so "iPhone rollout" stays "IPhone rollout", not "Iphone Rollout" — this is a minimum-effort
 * "don't start a sentence lowercase" fix, not a title-caser).
 */
function capitalizeFirst(value) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

module.exports = { capitalizeFirst };

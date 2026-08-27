// Small, dependency-free User-Agent reader for the "Active Sessions" list — good enough to show
// a recognizable browser/OS/device, not a full UA-parsing library. Order matters: Edge/Opera
// embed "Chrome" in their UA string too, so those checks must run before the Chrome check.
function parseBrowser(ua) {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return 'Safari';
  return 'Unknown Browser';
}

function parseOs(ua) {
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad|iOS/.test(ua)) return 'iOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown OS';
}

function parseDevice(ua) {
  if (/iPad|Tablet/.test(ua)) return 'Tablet';
  if (/Mobi|Android(?!.*Tablet)/.test(ua)) return 'Mobile';
  return 'Desktop';
}

function parseUserAgent(ua = '') {
  return { browser: parseBrowser(ua), os: parseOs(ua), device: parseDevice(ua) };
}

module.exports = parseUserAgent;

// Audit log rows already carry a full before/after JSON snapshot of the record (`oldValue`/
// `newValue`) — this pulls a human-readable label out of that snapshot instead of showing the
// raw entity id, trying each entity type's actual "name-like" field in turn since there's no
// single common column across ~20 different tracked models.
const NAME_FIELDS = ['name', 'title', 'version', 'endpoint', 'docTableName', 'fileName', 'label', 'email'];

export function getAuditEntityName(log) {
  const snapshot = log.newValue || log.oldValue;

  if (snapshot) {
    for (const field of NAME_FIELDS) {
      if (snapshot[field]) return String(snapshot[field]);
    }

    // Comments/votes have no name/title field at all — fall back to a short preview of the body.
    if (snapshot.body) {
      const body = String(snapshot.body);
      return body.length > 40 ? `${body.slice(0, 40)}…` : body;
    }
  }

  // login/logout/change-password entries carry no before/after snapshot at all (there's no record
  // to diff) and their entityId is just the acting user's own id — show their name instead of a
  // raw uuid, same as we would if a "name" field had been present in a snapshot.
  if (log.entityId && log.entityId === log.userId && log.user?.name) {
    return log.user.name;
  }

  return null;
}

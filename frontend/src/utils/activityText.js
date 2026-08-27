import humanize from './humanize';

// English "a"/"an" doesn't follow a spelling rule (compare "a user" vs "an hour"), so rather than
// guess from the first letter, this lists the entity types (a fixed, known vocabulary — these
// come from the backend's audit `entityType` values) that actually take "an".
const AN_ENTITY_TYPES = new Set(['idea', 'application', 'ai_prompt', 'architecture_doc', 'api_endpoint', 'attachment']);

/** {user:{name:'Adam'}, action:'update', entityType:'idea'} -> "Adam updated an idea" */
export function describeAuditAction(log) {
  const actor = log.user?.name || 'System';
  const verb = `${log.action}d`; // create -> created, update -> updated, delete -> deleted
  const article = AN_ENTITY_TYPES.has(log.entityType) ? 'an' : 'a';
  return `${actor} ${verb} ${article} ${humanize(log.entityType).toLowerCase()}`;
}

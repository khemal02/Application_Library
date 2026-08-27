const logger = require('../config/logger');

const METHOD_ACTION_MAP = { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' };

/**
 * Fire-and-forget audit trail write. Never throws into the request path — a logging failure
 * must not fail the underlying business operation.
 */
async function logAction({ req, action, entityType, entityId, oldValue = null, newValue = null }) {
  try {
    const { AuditLog } = require('../models');
    await AuditLog.create({
      userId: req?.user?.id || null,
      action: action || METHOD_ACTION_MAP[req?.method] || 'update',
      entityType,
      entityId: entityId || null,
      oldValue,
      newValue,
      ipAddress: req?.ip,
    });
  } catch (err) {
    logger.error('Failed to write audit log', { error: err.message, entityType, entityId });
  }
}

module.exports = { logAction };

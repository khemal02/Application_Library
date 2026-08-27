const { Op } = require('sequelize');
const {
  Comment, Attachment, Vote, Taggable, StatusHistory, Notification,
} = require('../models');

// Notifications carry no typed entity reference at all — `link` is a plain string a service
// builds by hand (e.g. `/ideas/${id}`), not a foreign key, so matching on it is inherently
// fragile string matching rather than a real relationship. This map only covers the entityTypes
// that actually have their own detail-page URL; `_note`-style secondary comment channels
// (idea_note, suggestion_note) have no independent link of their own — any notification a comment
// on one of those generates is already linked to the core entity's page and gets caught there.
const NOTIFICATION_LINK_PREFIX = {
  idea: '/ideas/',
  suggestion: '/suggestions/',
  application: '/applications/',
};

/**
 * Deletes every polymorphic row that references one entity — comments (and, for each of those
 * comments, their attachments), votes, tags, status history, and notifications — none of which
 * carry a real foreign key to the entity they describe (they're all generic entityType/entityId
 * pairs shared across ideas/suggestions/applications), so nothing at the database level cascades
 * them on its own. `idea_reviews` is the one exception and already has a real FK with
 * ON DELETE CASCADE — nothing to do here for that table.
 *
 * Callers must run this inside the SAME transaction as the entity's own destroy() and pass it via
 * `transaction` — a deleted entity whose comments/votes/notifications survive it is the bug this
 * closes, so a cleanup that isn't atomic with the delete is the same bug with extra steps.
 *
 * Attachment FILES are deliberately not removed from disk here — file deletion isn't part of the
 * SQL transaction and can't be rolled back, so unlinking eagerly would leave orphaned-in-the-
 * other-direction state (files gone, rows restored) if the transaction later fails or is rolled
 * back. Instead this returns the relative paths that need removing; the caller deletes them from
 * disk only after the transaction has actually committed successfully.
 *
 * Returns `{ counts, filePaths }` — `counts` has one entry per table so callers can log exactly
 * what was removed; `filePaths` is the flat list of attachment files the caller must still unlink.
 */
async function cleanupEntityRefs(entityType, entityId, { transaction } = {}) {
  const counts = {
    comments: 0, attachments: 0, votes: 0, taggables: 0, statusHistory: 0, notifications: 0,
  };
  const filePaths = [];

  // A reply shares its root's entityType/entityId (only parentCommentId marks it as a reply), so
  // one flat query already returns every comment AND every nested reply in the thread — no
  // recursion needed.
  const comments = await Comment.findAll({ where: { entityType, entityId }, attributes: ['id'], transaction });
  const commentIds = comments.map((c) => c.id);

  if (commentIds.length > 0) {
    const attachments = await Attachment.findAll({
      where: { entityType: 'comment', entityId: { [Op.in]: commentIds } }, transaction,
    });
    filePaths.push(...attachments.map((a) => a.filePath));

    counts.attachments = await Attachment.destroy({
      where: { entityType: 'comment', entityId: { [Op.in]: commentIds } }, transaction,
    });
    counts.comments = await Comment.destroy({ where: { entityType, entityId }, transaction });
  }

  counts.votes = await Vote.destroy({ where: { entityType, entityId }, transaction });
  counts.taggables = await Taggable.destroy({ where: { entityType, entityId }, transaction });
  counts.statusHistory = await StatusHistory.destroy({ where: { entityType, entityId }, transaction });

  const linkPrefix = NOTIFICATION_LINK_PREFIX[entityType];
  if (linkPrefix) {
    // Prefix match, not equality — a link nested under the entity's page (not just the bare
    // page itself) still gets caught. entityId is a UUID (hex + dashes only), so it's always
    // safe to interpolate directly into a LIKE pattern with no wildcard-escaping concern.
    counts.notifications = await Notification.destroy({
      where: { link: { [Op.like]: `${linkPrefix}${entityId}%` } }, transaction,
    });
  }

  return { counts, filePaths };
}

/** Merges two or more cleanupEntityRefs() count objects, field by field — for a caller that runs
 * it more than once (e.g. ideas' both 'idea' and legacy 'idea_note' entityTypes) and wants one
 * combined tally to log. */
function mergeCounts(...countObjects) {
  const merged = {
    comments: 0, attachments: 0, votes: 0, taggables: 0, statusHistory: 0, notifications: 0,
  };
  for (const c of countObjects) {
    for (const key of Object.keys(merged)) merged[key] += c[key] || 0;
  }
  return merged;
}

module.exports = { cleanupEntityRefs, mergeCounts };

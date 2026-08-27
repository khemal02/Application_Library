const { Comment, User, Role, Idea } = require('../../models');
const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');
const { isPrivileged } = require('../../middlewares/ownership.middleware');
const notificationsService = require('../notifications/notifications.service');

// Comments are generic (shared across ideas, suggestions, applications, ...), but the idea
// submitter specifically wants to know whenever anyone weighs in on THEIR idea — covers both
// entityTypes an idea's detail page posts comments under: 'idea' (the general Comments thread)
// and 'idea_note' (the "Discussion" notes section).
const IDEA_ENTITY_TYPES = ['idea', 'idea_note'];

const authorInclude = {
  model: User,
  as: 'author',
  attributes: ['id', 'name', 'avatarUrl'],
  include: [{ model: Role, as: 'role', attributes: ['id', 'name'] }],
};

async function listByEntity(entityType, entityId) {
  const all = await Comment.findAll({
    where: { entityType, entityId },
    include: [authorInclude],
    order: [['createdAt', 'ASC']],
  });

  const byId = new Map(all.map((c) => [c.id, { ...c.toJSON(), replies: [] }]));
  const roots = [];
  byId.forEach((comment) => {
    if (comment.parentCommentId && byId.has(comment.parentCommentId)) {
      byId.get(comment.parentCommentId).replies.push(comment);
    } else {
      roots.push(comment);
    }
  });
  return roots;
}

async function create(userId, payload) {
  let idea = null;
  if (IDEA_ENTITY_TYPES.includes(payload.entityType)) {
    idea = await Idea.findByPk(payload.entityId, { attributes: ['id', 'title', 'submittedBy', 'status'] });
    // Frozen once decided — a decision (approved/rejected) is final, and re-opening the thread
    // after the fact would misrepresent it as still-open discussion. Enforced here, not just
    // hidden in the UI, so the rule holds regardless of client.
    if (idea && (idea.status === 'approved' || idea.status === 'rejected')) {
      throw ApiError.badRequest('This idea has been decided — the discussion thread is now read-only.');
    }
  }

  const comment = await Comment.create({ ...payload, userId });
  const full = await Comment.findByPk(comment.id, { include: [authorInclude] });

  if (idea) {
    try {
      if (idea.submittedBy !== userId) {
        // The commenter's name belongs in `title` — the bold, prominent line NotificationPanel
        // renders — not just tucked into the smaller `message` caption underneath it, where a
        // generic title reading "Someone commented" makes the name easy to miss entirely.
        const authorName = full.author?.name || 'Someone';
        await notificationsService.create({
          userId: idea.submittedBy,
          type: 'idea_comment_added',
          title: `${authorName} commented on your idea`,
          message: `"${idea.title}"`,
          link: `/ideas/${idea.id}`,
        });
      }
    } catch (err) {
      logger.error('Failed to create idea-comment notification', {
        error: { message: err.message, stack: err.stack }, entityType: payload.entityType, entityId: payload.entityId,
      });
    }
  }

  return full;
}

async function remove(id, requester) {
  const comment = await Comment.findByPk(id);
  if (!comment) throw ApiError.notFound('Comment not found');
  const isOwner = comment.userId === requester.id;
  const privileged = isPrivileged(requester);
  if (!isOwner && !privileged) throw ApiError.forbidden('You can only delete your own comments');

  // Frozen once decided, same as create — read-only means the record is frozen, not just closed
  // to new posts. A super admin may still delete for moderation (e.g. abuse/spam); anyone else,
  // owner included, cannot erase their own comment off a decided idea's record.
  if (IDEA_ENTITY_TYPES.includes(comment.entityType) && !privileged) {
    const idea = await Idea.findByPk(comment.entityId, { attributes: ['id', 'status'] });
    if (idea && (idea.status === 'approved' || idea.status === 'rejected')) {
      throw ApiError.badRequest('This idea has been decided — the discussion thread is now read-only.');
    }
  }

  await comment.destroy();
  return comment;
}

module.exports = { listByEntity, create, remove };

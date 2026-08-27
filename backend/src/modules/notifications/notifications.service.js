const { Notification } = require('../../models');
const { buildQueryOptions, buildPaginationMeta } = require('../../utils/paginate');
const ApiError = require('../../utils/ApiError');

async function list(userId, query) {
  const { where, order, limit, offset, page } = buildQueryOptions(query, {
    filterableFields: ['isRead'],
    defaultSort: [['createdAt', 'DESC']],
  });
  const { rows, count } = await Notification.findAndCountAll({
    where: { ...where, userId }, order, limit, offset,
  });
  return { items: rows, pagination: buildPaginationMeta({ page, limit, count }) };
}

async function unreadCount(userId) {
  const count = await Notification.count({ where: { userId, isRead: false } });
  return { count };
}

async function markRead(userId, id) {
  const notification = await Notification.findOne({ where: { id, userId } });
  if (!notification) throw ApiError.notFound('Notification not found');
  await notification.update({ isRead: true });
  return notification;
}

async function markAllRead(userId) {
  await Notification.update({ isRead: true }, { where: { userId, isRead: false } });
  return { message: 'All notifications marked as read' };
}

/** Used by other modules' services to push a notification — not exposed as a public route. */
async function create({ userId, type, title, message, link }) {
  return Notification.create({ userId, type, title, message, link });
}

/** Bulk variant for fan-out (e.g. notifying every stage-owner reviewer for one transition). */
async function createMany(rows) {
  if (!rows.length) return [];
  return Notification.bulkCreate(rows);
}

module.exports = { list, unreadCount, markRead, markAllRead, create, createMany };

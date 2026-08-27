const { Op } = require('sequelize');
const { User, Role, Department, UserSession, AuditLog, RolePermission } = require('../../models');
const { buildQueryOptions, buildPaginationMeta } = require('../../utils/paginate');
const { logAction } = require('../../utils/auditLogger');
const ApiError = require('../../utils/ApiError');

const DEFAULT_PRIVACY = {
  showEmail: true,
  showPhone: false,
  showDepartment: true,
  showDesignation: true,
  allowProfileView: true,
};

const profileInclude = [
  { model: Role, as: 'role' },
  { model: Department, as: 'department' },
  { model: User, as: 'reportingManager', attributes: ['id', 'name', 'email', 'designation'] },
];

async function getProfile(userId) {
  const user = await User.findByPk(userId, { include: profileInclude });
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

async function updateProfile(userId, payload) {
  const user = await User.findByPk(userId);
  if (!user) throw ApiError.notFound('User not found');
  await user.update(payload);
  await logAction({ req: { user: { id: userId } }, action: 'update', entityType: 'profile', entityId: userId, newValue: payload });
  return getProfile(userId);
}

async function getAccount(userId) {
  const user = await User.findByPk(userId, {
    include: [{ model: Role, as: 'role', include: [{ model: RolePermission, as: 'permissions' }] }],
  });
  if (!user) throw ApiError.notFound('User not found');
  return {
    username: user.email.split('@')[0],
    loginEmail: user.email,
    accountStatus: user.status,
    role: user.role?.label,
    permissions: (user.role?.permissions || []).map((p) => ({ resource: p.resource, action: p.action })),
    accountCreatedDate: user.createdAt,
  };
}

async function getPrivacy(userId) {
  const user = await User.findByPk(userId, { attributes: ['id', 'privacySettings'] });
  if (!user) throw ApiError.notFound('User not found');
  return { ...DEFAULT_PRIVACY, ...(user.privacySettings || {}) };
}

async function updatePrivacy(userId, settings) {
  const user = await User.findByPk(userId);
  if (!user) throw ApiError.notFound('User not found');
  await user.update({ privacySettings: settings });
  return settings;
}

async function listSessions(userId, currentJti) {
  const sessions = await UserSession.findAll({
    where: { userId, revokedAt: null },
    order: [['lastActiveAt', 'DESC']],
  });
  return sessions.map((s) => ({ ...s.toJSON(), isCurrent: s.jti === currentJti }));
}

async function revokeSession(userId, sessionId, currentJti) {
  const session = await UserSession.findOne({ where: { id: sessionId, userId } });
  if (!session) throw ApiError.notFound('Session not found');
  if (session.jti === currentJti) throw ApiError.badRequest('Use Logout to end your current session');
  await session.update({ revokedAt: new Date() });
  return { message: 'Session logged out' };
}

async function revokeOtherSessions(userId, currentJti) {
  await UserSession.update(
    { revokedAt: new Date() },
    { where: { userId, revokedAt: null, jti: { [Op.ne]: currentJti || '' } } },
  );
  return { message: 'All other sessions logged out' };
}

async function getActivity(userId, query) {
  const { where, order, limit, offset, page } = buildQueryOptions(query, {
    filterableFields: ['action', 'entityType'],
    defaultSort: [['createdAt', 'DESC']],
  });
  const { rows, count } = await AuditLog.findAndCountAll({
    where: { ...where, userId }, order, limit, offset,
  });
  return { items: rows, pagination: buildPaginationMeta({ page, limit, count }) };
}

module.exports = {
  getProfile, updateProfile, getAccount, getPrivacy, updatePrivacy,
  listSessions, revokeSession, revokeOtherSessions, getActivity,
};

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const env = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const parseUserAgent = require('../../utils/parseUserAgent');
const { logAction } = require('../../utils/auditLogger');
const { User, Role, RolePermission, UserSession } = require('../../models');

function toSafeUser(user) {
  const json = user.toJSON();
  delete json.passwordHash;
  return json;
}

function signToken(user, jti) {
  return jwt.sign({ sub: user.id, role: user.role?.name, jti }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
}

async function login({ email, password }, req) {
  const user = await User.scope('withPassword').findOne({
    where: { email },
    include: [{ model: Role, as: 'role', include: [{ model: RolePermission, as: 'permissions' }] }],
  });
  if (!user) throw ApiError.unauthorized('Invalid email or password');
  if (user.status !== 'active') throw ApiError.forbidden('Account is inactive — contact an administrator');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized('Invalid email or password');

  await user.update({ lastLoginAt: new Date() });

  const jti = uuidv4();
  const { browser, os, device } = parseUserAgent(req?.headers?.['user-agent'] || '');
  await UserSession.create({
    userId: user.id, jti, browser, os, device, ipAddress: req?.ip,
  });
  // Login happens before the auth middleware runs, so there's no req.user yet — build a
  // minimal stand-in so logAction attributes the entry to the account that just authenticated
  // (otherwise it'd be logged with userId: null and never show up in that user's own Activity tab).
  await logAction({ req: { user: { id: user.id }, ip: req?.ip }, action: 'login', entityType: 'auth', entityId: user.id });

  return { token: signToken(user, jti), user: toSafeUser(user) };
}

async function logout(userId, jti) {
  if (jti) {
    await UserSession.update({ revokedAt: new Date() }, { where: { userId, jti } });
  }
  await logAction({ req: { user: { id: userId } }, action: 'logout', entityType: 'auth', entityId: userId });
  return { message: 'Logged out' };
}

async function me(userId) {
  const user = await User.findByPk(userId, {
    include: [{ model: Role, as: 'role', include: [{ model: RolePermission, as: 'permissions' }] }],
  });
  if (!user) throw ApiError.notFound('User not found');
  return toSafeUser(user);
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.scope('withPassword').findByPk(userId);
  if (!user) throw ApiError.notFound('User not found');
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw ApiError.badRequest('Current password is incorrect');
  await user.update({ passwordHash: await bcrypt.hash(newPassword, 10) });
  await logAction({ req: { user: { id: userId } }, action: 'update', entityType: 'password', entityId: userId });
  return { message: 'Password updated' };
}

module.exports = { login, logout, me, changePassword };

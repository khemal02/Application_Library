const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const env = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const parseUserAgent = require('../../utils/parseUserAgent');
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
  return { token: signToken(user, jti), user: toSafeUser(user) };
}

async function logout(userId, jti) {
  if (jti) {
    await UserSession.update({ revokedAt: new Date() }, { where: { userId, jti } });
  }
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
  return { message: 'Password updated' };
}

module.exports = { login, logout, me, changePassword };

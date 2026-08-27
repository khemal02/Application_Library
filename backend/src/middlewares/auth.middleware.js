const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { User, Role, RolePermission, UserSession } = require('../models');

/**
 * Verifies the JWT, then loads the user's role + permission set fresh from the DB on every
 * request. Slightly more DB work than embedding permissions in the token, but it means a role
 * change takes effect immediately instead of waiting for token expiry.
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw ApiError.unauthorized('Authentication token missing');

  let payload;
  try {
    payload = jwt.verify(token, env.jwt.secret);
  } catch (err) {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  const user = await User.findByPk(payload.sub, {
    include: [{ model: Role, as: 'role', include: [{ model: RolePermission, as: 'permissions' }] }],
  });
  if (!user || user.status !== 'active') throw ApiError.unauthorized('Account is no longer active');

  // Tokens issued before session tracking existed have no jti — those stay valid until they
  // naturally expire. Tokens with a jti must still have a live (non-revoked) session row, which
  // is how the Security tab's "Logout Session" / "Logout All Other Devices" actually take effect
  // immediately instead of waiting for token expiry.
  if (payload.jti) {
    const session = await UserSession.findOne({ where: { jti: payload.jti } });
    if (!session || session.revokedAt) throw ApiError.unauthorized('Session has been logged out');
  }

  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: user.roleId,
    roleName: user.role?.name,
    departmentId: user.departmentId,
    functionalAreas: user.functionalAreas,
    permissions: (user.role?.permissions || []).map((p) => ({ resource: p.resource, action: p.action })),
    jti: payload.jti,
  };
  next();
});

module.exports = { authenticate };

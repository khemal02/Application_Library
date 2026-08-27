const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { createCrudService } = require('../../utils/crudFactory');
const { User, Role, Department } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { ROLE_LABELS } = require('../../utils/reviewPanel');

const include = [
  { model: Role, as: 'role' },
  { model: Department, as: 'department' },
];

const base = createCrudService(User, {
  searchableFields: ['name', 'email'],
  filterableFields: ['roleId', 'departmentId', 'status'],
  include,
  notFoundMessage: 'User not found',
});

// Ideas/Suggestions review-routing now runs purely on functional area (see
// utils/reviewPanel.js#eligibleReviewers) — for that to give deterministic, single-owner routing
// rather than the old ambiguous "several people all eligible" pool, at most one active Team Lead
// and one active Manager may hold any given functional area at a time. Enforced here as an
// application-level check (not a DB constraint — a partial-unique-index can't cleanly express
// "unique per array element, scoped by a joined role" for a Postgres ARRAY column), so it's a
// check-then-write, not race-proof under concurrent admin edits — acceptable for a low-frequency
// admin action, not for a high-concurrency one.
async function assertFunctionalAreaOwnershipAvailable({ userId, roleId, functionalAreas }) {
  if (!roleId || !functionalAreas || functionalAreas.length === 0) return;

  const role = await Role.findByPk(roleId);
  if (!role || !['team_lead', 'manager'].includes(role.name)) return;

  const conflict = await User.findOne({
    where: {
      status: 'active',
      functionalAreas: { [Op.overlap]: functionalAreas },
      ...(userId ? { id: { [Op.ne]: userId } } : {}),
    },
    include: [{ model: Role, as: 'role', where: { name: role.name } }],
  });
  if (!conflict) return;

  const overlapping = functionalAreas.find((fa) => (conflict.functionalAreas || []).includes(fa));
  const roleLabel = ROLE_LABELS[role.name];
  throw ApiError.badRequest(
    `${conflict.name} is already the ${roleLabel} for "${overlapping}" — a functional area can only have one active ${roleLabel}.`,
  );
}

async function create(payload) {
  await assertFunctionalAreaOwnershipAvailable({
    userId: null, roleId: payload.roleId, functionalAreas: payload.functionalAreas || [],
  });
  const passwordHash = await bcrypt.hash(payload.password, 10);
  const { password, ...rest } = payload;
  return User.create({ ...rest, passwordHash });
}

async function update(id, payload) {
  const current = await User.findByPk(id);
  if (!current) throw ApiError.notFound('User not found');

  await assertFunctionalAreaOwnershipAvailable({
    userId: id,
    roleId: payload.roleId ?? current.roleId,
    functionalAreas: payload.functionalAreas ?? current.functionalAreas,
  });

  await current.update(payload);
  return current;
}

async function updateProfile(userId, payload) {
  const user = await User.findByPk(userId);
  if (!user) throw ApiError.notFound('User not found');
  await user.update(payload);
  return user;
}

module.exports = { ...base, create, update, updateProfile };

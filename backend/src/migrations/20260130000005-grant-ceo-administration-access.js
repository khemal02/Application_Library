'use strict';
const { v4: uuidv4 } = require('uuid');

// CEO gains access to the Administration area's Users and Departments & Teams pages (full
// manage). Roles & Permissions stays Admin-only — that's system-level permission configuration,
// not business/org administration, and editing it can grant privileges (including to oneself).
//
// On a fresh install this runs before the role_permissions seeder populates any rows, so the
// lookup below finds nothing and this migration is a harmless no-op — the seeder already grants
// this to CEO directly in that case.
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [roles] = await queryInterface.sequelize.query("SELECT id FROM roles WHERE name = 'ceo'");
    if (!roles.length) return;
    const ceoId = roles[0].id;

    const [existing] = await queryInterface.sequelize.query(
      "SELECT resource FROM role_permissions WHERE role_id = :id AND resource IN ('users','departments','teams') AND action = 'manage'",
      { replacements: { id: ceoId } },
    );
    const already = new Set(existing.map((r) => r.resource));
    const rows = ['users', 'departments', 'teams']
      .filter((resource) => !already.has(resource))
      .map((resource) => ({ id: uuidv4(), role_id: ceoId, resource, action: 'manage', created_at: now, updated_at: now }));

    if (rows.length) await queryInterface.bulkInsert('role_permissions', rows);
  },

  async down(queryInterface) {
    const [roles] = await queryInterface.sequelize.query("SELECT id FROM roles WHERE name = 'ceo'");
    if (!roles.length) return;
    await queryInterface.sequelize.query(
      "DELETE FROM role_permissions WHERE role_id = :id AND resource IN ('users','departments','teams') AND action = 'manage'",
      { replacements: { id: roles[0].id } },
    );
  },
};

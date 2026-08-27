'use strict';

// The Administration section (Users, Roles & Permissions, Departments & Teams) should be
// visible/usable only by the Admin role. Manager previously had 'manage' on users/departments/
// teams, and Team Lead had 'read' on users (to see who's on their team) — both of those grants
// are removed here; Admin (unrestricted '*':manage) is unaffected.
//
// On a fresh install this runs before the role_permissions seeder populates any rows, so the
// lookups below find nothing and this migration is a harmless no-op — the seeder already
// creates the restricted permission set directly in that case.
module.exports = {
  async up(queryInterface) {
    const [roles] = await queryInterface.sequelize.query('SELECT id, name FROM roles');
    if (!roles.length) return;
    const byName = Object.fromEntries(roles.map((r) => [r.name, r.id]));

    if (byName.manager) {
      await queryInterface.sequelize.query(
        `DELETE FROM role_permissions WHERE role_id = :id AND resource IN ('users', 'departments', 'teams')`,
        { replacements: { id: byName.manager } },
      );
    }
    if (byName.team_lead) {
      await queryInterface.sequelize.query(
        `DELETE FROM role_permissions WHERE role_id = :id AND resource = 'users'`,
        { replacements: { id: byName.team_lead } },
      );
    }
  },

  async down() {},
};

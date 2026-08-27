'use strict';
const { v4: uuidv4 } = require('uuid');

// Audit Logs should be visible to Admin, CEO, Manager, and Team Lead — not Employee. Admin/CEO/
// Manager already have audit_logs:read; Team Lead was missing it (Employee correctly has none).
//
// On a fresh install this runs before the role_permissions seeder populates any rows, so the
// lookup below finds nothing and this migration is a harmless no-op — the seeder already grants
// Team Lead this permission directly in that case.
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [roles] = await queryInterface.sequelize.query("SELECT id FROM roles WHERE name = 'team_lead'");
    if (!roles.length) return;
    const teamLeadId = roles[0].id;

    const [existing] = await queryInterface.sequelize.query(
      "SELECT id FROM role_permissions WHERE role_id = :id AND resource = 'audit_logs' AND action = 'read'",
      { replacements: { id: teamLeadId } },
    );
    if (existing.length) return;

    await queryInterface.bulkInsert('role_permissions', [{
      id: uuidv4(), role_id: teamLeadId, resource: 'audit_logs', action: 'read', created_at: now, updated_at: now,
    }]);
  },

  async down(queryInterface) {
    const [roles] = await queryInterface.sequelize.query("SELECT id FROM roles WHERE name = 'team_lead'");
    if (!roles.length) return;
    await queryInterface.sequelize.query(
      "DELETE FROM role_permissions WHERE role_id = :id AND resource = 'audit_logs' AND action = 'read'",
      { replacements: { id: roles[0].id } },
    );
  },
};

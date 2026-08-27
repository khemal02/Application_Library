'use strict';
const { v4: uuidv4 } = require('uuid');

// Export (PDF/Excel) on the Applications/Ideas/Suggestions list pages is visible to every role,
// but role_permissions only granted 'reports':'read' to super_admin/admin/team_lead — so
// developer/reviewer/employee got a silent 403 with no feedback when clicking Export. These
// three roles can already read the underlying lists, so they should be able to export them too.
const ROLE_NAMES = ['developer', 'reviewer', 'employee'];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [roles] = await queryInterface.sequelize.query(
      `SELECT id, name FROM roles WHERE name IN (:names)`,
      { replacements: { names: ROLE_NAMES } },
    );

    const [existing] = await queryInterface.sequelize.query(
      `SELECT role_id FROM role_permissions WHERE resource = 'reports' AND action = 'read'`,
    );
    const alreadyGranted = new Set(existing.map((r) => r.role_id));

    const rows = roles
      .filter((role) => !alreadyGranted.has(role.id))
      .map((role) => ({
        id: uuidv4(), role_id: role.id, resource: 'reports', action: 'read', created_at: now, updated_at: now,
      }));

    if (rows.length) await queryInterface.bulkInsert('role_permissions', rows);
  },

  async down(queryInterface) {
    const [roles] = await queryInterface.sequelize.query(
      `SELECT id FROM roles WHERE name IN (:names)`,
      { replacements: { names: ROLE_NAMES } },
    );
    const roleIds = roles.map((r) => r.id);
    if (roleIds.length) {
      await queryInterface.sequelize.query(
        `DELETE FROM role_permissions WHERE resource = 'reports' AND action = 'read' AND role_id IN (:roleIds)`,
        { replacements: { roleIds } },
      );
    }
  },
};

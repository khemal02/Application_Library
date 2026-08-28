'use strict';
const { v4: uuidv4 } = require('uuid');

// Change Requests get full CRUD for everyone, not just Team Lead+ — Employee had create/read from
// 20260130000030; this backfills update/delete so it matches Team Lead's grant exactly.
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [roles] = await queryInterface.sequelize.query("SELECT id FROM roles WHERE name = 'employee'");
    if (!roles.length) return;
    const employeeId = roles[0].id;

    const [existing] = await queryInterface.sequelize.query(
      "SELECT action FROM role_permissions WHERE role_id = :id AND resource = 'change_requests'",
      { replacements: { id: employeeId } },
    );
    const already = new Set(existing.map((r) => r.action));

    const rows = ['update', 'delete']
      .filter((action) => !already.has(action))
      .map((action) => ({ id: uuidv4(), role_id: employeeId, resource: 'change_requests', action, created_at: now, updated_at: now }));

    if (rows.length) await queryInterface.bulkInsert('role_permissions', rows);
  },

  async down(queryInterface) {
    const [roles] = await queryInterface.sequelize.query("SELECT id FROM roles WHERE name = 'employee'");
    if (!roles.length) return;
    await queryInterface.sequelize.query(
      "DELETE FROM role_permissions WHERE role_id = :id AND resource = 'change_requests' AND action IN ('update', 'delete')",
      { replacements: { id: roles[0].id } },
    );
  },
};

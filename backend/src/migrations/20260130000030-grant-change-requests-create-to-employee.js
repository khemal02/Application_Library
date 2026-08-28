'use strict';
const { v4: uuidv4 } = require('uuid');

// Everyone should be able to raise a Change Request, not just Team Lead+ — Employee previously
// only got change_requests:read via 20260130000029 (it was bundled into the read-only
// DOC_SUBRESOURCES treatment). Same idea as ideas/suggestions: create is open to every role.
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [roles] = await queryInterface.sequelize.query("SELECT id FROM roles WHERE name = 'employee'");
    if (!roles.length) return;
    const employeeId = roles[0].id;

    const [existing] = await queryInterface.sequelize.query(
      "SELECT id FROM role_permissions WHERE role_id = :id AND resource = 'change_requests' AND action = 'create'",
      { replacements: { id: employeeId } },
    );
    if (existing.length) return;

    await queryInterface.bulkInsert('role_permissions', [{
      id: uuidv4(), role_id: employeeId, resource: 'change_requests', action: 'create', created_at: now, updated_at: now,
    }]);
  },

  async down(queryInterface) {
    const [roles] = await queryInterface.sequelize.query("SELECT id FROM roles WHERE name = 'employee'");
    if (!roles.length) return;
    await queryInterface.sequelize.query(
      "DELETE FROM role_permissions WHERE role_id = :id AND resource = 'change_requests' AND action = 'create'",
      { replacements: { id: roles[0].id } },
    );
  },
};

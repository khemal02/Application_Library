'use strict';

// Employees should only be able to submit ideas/suggestions and edit their own — not advance
// them through the workflow (Discussion -> Review -> Approved -> Development Ready, etc.). The
// 'review' action is what gates the PATCH /:id/status transition routes for both ideas and
// suggestions, so removing it here is the entire fix; create/read/update stay intact.
//
// On a fresh install this runs before the role_permissions seeder populates any rows, so the
// lookup below finds nothing and this migration is a harmless no-op — the seeder already omits
// this grant for Employee directly in that case.
module.exports = {
  async up(queryInterface) {
    const [roles] = await queryInterface.sequelize.query("SELECT id FROM roles WHERE name = 'employee'");
    if (!roles.length) return;
    await queryInterface.sequelize.query(
      "DELETE FROM role_permissions WHERE role_id = :id AND resource IN ('ideas', 'suggestions') AND action = 'review'",
      { replacements: { id: roles[0].id } },
    );
  },

  async down(queryInterface) {
    const { v4: uuidv4 } = require('uuid');
    const [roles] = await queryInterface.sequelize.query("SELECT id FROM roles WHERE name = 'employee'");
    if (!roles.length) return;
    const now = new Date();
    await queryInterface.bulkInsert('role_permissions', [
      { id: uuidv4(), role_id: roles[0].id, resource: 'ideas', action: 'review', created_at: now, updated_at: now },
      { id: uuidv4(), role_id: roles[0].id, resource: 'suggestions', action: 'review', created_at: now, updated_at: now },
    ]);
  },
};

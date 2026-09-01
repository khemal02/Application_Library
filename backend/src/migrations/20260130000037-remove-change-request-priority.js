'use strict';

// Removes the Change Request module's own `priority` field entirely, per explicit instruction —
// same full-removal treatment as 20260130000034-remove-application-priority.js. This permanently
// discards whatever value each change request currently has; there is no partial/UI-only version
// of this change. NOT to be confused with applications.priority (already removed) or
// ideas.priority/feature_requests.priority, which are separate columns on separate tables and are
// untouched by this migration.
module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn('change_requests', 'priority');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_change_requests_priority";');
  },

  async down(queryInterface, Sequelize) {
    // Recreates the column with its original type/default — cannot restore each change request's
    // individual prior value, since that data is deliberately gone, not just hidden.
    await queryInterface.addColumn('change_requests', 'priority', {
      type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
      allowNull: false,
      defaultValue: 'medium',
    });
  },
};

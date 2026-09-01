'use strict';

// Removes the Application module's own `priority` field entirely, per explicit instruction —
// this permanently discards whatever value each application currently has (there is no partial/
// UI-only version of this change; that was a deliberate choice, not an oversight). NOT to be
// confused with change_requests.priority or ideas.priority, which are separate columns on
// separate tables and are untouched by this migration.
module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn('applications', 'priority');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_applications_priority";');
  },

  async down(queryInterface, Sequelize) {
    // Recreates the column with its original type/default — cannot restore each application's
    // individual prior value, since that data is deliberately gone, not just hidden.
    await queryInterface.addColumn('applications', 'priority', {
      type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
      allowNull: false,
      defaultValue: 'medium',
    });
  },
};

'use strict';

// Suggestions are now triaged by Priority alone — Severity was a redundant second low/medium/
// high/critical axis alongside it. Drops the column and its enum type.
module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn('application_suggestions', 'severity');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_application_suggestions_severity"');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('application_suggestions', 'severity', {
      type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
      allowNull: true,
    });
  },
};

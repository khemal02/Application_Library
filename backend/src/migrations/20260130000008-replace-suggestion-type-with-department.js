'use strict';

// Suggestions no longer classify themselves by a fixed `type` enum — they're tagged with the
// submitting Department instead, same as Ideas already are. Drops `type` (and its enum) and adds
// a nullable `department_id` FK, matching the ideas.department_id shape.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('application_suggestions', 'department_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'departments', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.removeColumn('application_suggestions', 'type');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_application_suggestions_type"');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('application_suggestions', 'type', {
      type: Sequelize.ENUM(
        'feature_request', 'bug_report', 'ui_improvement', 'security_improvement',
        'performance_improvement', 'ai_enhancement', 'database_optimization',
        'api_improvement', 'cost_optimization',
      ),
      allowNull: true,
    });
    await queryInterface.removeColumn('application_suggestions', 'department_id');
  },
};

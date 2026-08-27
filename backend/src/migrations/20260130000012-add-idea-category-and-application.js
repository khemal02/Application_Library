'use strict';

// Splits Ideas into two categories, surfaced in the sidebar as two entries under "Ideas": plain
// "New Ideas" (category = new_idea, unchanged behavior) and "New Features to Existing Application"
// (category = existing_app_feature, additionally linked to an Application via application_id).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ideas', 'category', {
      type: Sequelize.ENUM('new_idea', 'existing_app_feature'),
      allowNull: false,
      defaultValue: 'new_idea',
    });
    await queryInterface.addColumn('ideas', 'application_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'applications', key: 'id' },
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ideas', 'application_id');
    await queryInterface.removeColumn('ideas', 'category');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ideas_category"');
  },
};

'use strict';

// Second routing signal for Suggestions' new review panel, alongside the existing departmentId —
// see utils/reviewPanel.js#eligibleReviewers. Auto-filled from the linked Application on create,
// same as departmentId already is (see applicationSuggestion.model.js and suggestions.service.js).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('application_suggestions', 'functional_area', {
      type: Sequelize.STRING(60),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('application_suggestions', 'functional_area');
  },
};

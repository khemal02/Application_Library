'use strict';

// A user can now be tagged with zero or more functional areas (Finance, Supply Chain, ...) — a
// second, independent routing signal alongside departmentId for Ideas/Suggestions review
// eligibility (see ideas.service.js#eligibleReviewers). Defaults to '{}' (empty array), which
// participates in no OR-match at all, so every existing user's eligibility is unchanged until an
// admin actually assigns them a functional area.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'functional_areas', {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: false,
      defaultValue: [],
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'functional_areas');
  },
};

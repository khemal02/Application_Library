'use strict';

// New Idea form field, alongside businessProblem/proposedSolution/expectedBenefits/aiUsage/
// technologySuggestion — free-text notes on what technologies the idea would use and what
// efficiency gains it's expected to bring. Optional, same as its siblings.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ideas', 'technologies_and_efficiency', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ideas', 'technologies_and_efficiency');
  },
};

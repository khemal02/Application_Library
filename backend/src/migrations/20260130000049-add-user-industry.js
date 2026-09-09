'use strict';

// A single industry per user (same shared list Applications/Ideas already use — see
// utils/validators.js#INDUSTRIES), alongside the existing departmentId/functionalAreas. Shown
// read-only on Profile, set by an admin via the Users management form — nullable, no backfill.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'industry', {
      type: Sequelize.STRING(60),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'industry');
  },
};

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('applications', 'industry', { type: Sequelize.STRING(60), allowNull: true });
    await queryInterface.addColumn('applications', 'functional_area', { type: Sequelize.STRING(60), allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('applications', 'industry');
    await queryInterface.removeColumn('applications', 'functional_area');
  },
};

'use strict';

// Adds the fields the new Profile & Settings module's "Profile" tab needs. All nullable —
// existing users simply show an empty state for whichever ones aren't backfilled.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'employee_id', { type: Sequelize.STRING(50), allowNull: true });
    await queryInterface.addColumn('users', 'phone', { type: Sequelize.STRING(30), allowNull: true });
    await queryInterface.addColumn('users', 'designation', { type: Sequelize.STRING(150), allowNull: true });
    await queryInterface.addColumn('users', 'office_location', { type: Sequelize.STRING(150), allowNull: true });
    await queryInterface.addColumn('users', 'joining_date', { type: Sequelize.DATEONLY, allowNull: true });
    await queryInterface.addColumn('users', 'bio', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.addColumn('users', 'reporting_manager_id', {
      type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('users', 'privacy_settings', { type: Sequelize.JSONB, allowNull: true });
    await queryInterface.addIndex('users', ['employee_id'], { unique: true, name: 'users_employee_id_unique' });
    await queryInterface.addIndex('users', ['reporting_manager_id'], { name: 'users_reporting_manager_id' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('users', 'users_reporting_manager_id');
    await queryInterface.removeIndex('users', 'users_employee_id_unique');
    await queryInterface.removeColumn('users', 'privacy_settings');
    await queryInterface.removeColumn('users', 'reporting_manager_id');
    await queryInterface.removeColumn('users', 'bio');
    await queryInterface.removeColumn('users', 'joining_date');
    await queryInterface.removeColumn('users', 'office_location');
    await queryInterface.removeColumn('users', 'designation');
    await queryInterface.removeColumn('users', 'phone');
    await queryInterface.removeColumn('users', 'employee_id');
  },
};

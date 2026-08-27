'use strict';

// The app only ever needed one level of org grouping (Department) — Team was an unused second
// layer. Drops team_id from users/applications and the teams table itself. Down() recreates the
// empty table/columns for schema symmetry, but the team assignments themselves are not
// recoverable (same "lossy, not meaningfully reversible" tradeoff as the earlier role-model
// migrations in this history).
module.exports = {
  async up(queryInterface) {
    // Orphaned RBAC grants for the 'teams' resource (e.g. CEO's teams:manage from an earlier
    // migration) — no route checks this resource anymore now that the module is gone.
    await queryInterface.sequelize.query("DELETE FROM role_permissions WHERE resource = 'teams'");
    await queryInterface.removeColumn('users', 'team_id');
    await queryInterface.removeColumn('applications', 'team_id');
    await queryInterface.dropTable('teams');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.createTable('teams', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING(120), allowNull: false },
      department_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'departments', key: 'id' }, onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('teams', ['department_id', 'name'], { unique: true });
    await queryInterface.addColumn('users', 'team_id', { type: Sequelize.UUID, allowNull: true });
    await queryInterface.addColumn('applications', 'team_id', { type: Sequelize.UUID, allowNull: true });
  },
};

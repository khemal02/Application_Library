'use strict';

// One change request per (application, request) — raised against an application at any point in
// its development/testing/deployment lifecycle. Kept deliberately simple: title/description/
// priority/status, plus who raised it (auto-filled from the requester in the service layer, same
// as bug_history.reported_by).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('change_requests', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      application_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'applications', key: 'id' }, onDelete: 'CASCADE' },
      title: { type: Sequelize.STRING(200), allowNull: false },
      description: { type: Sequelize.TEXT },
      priority: { type: Sequelize.ENUM('low', 'medium', 'high', 'critical'), allowNull: false, defaultValue: 'medium' },
      status: { type: Sequelize.ENUM('pending', 'in_review', 'approved', 'rejected', 'implemented'), allowNull: false, defaultValue: 'pending' },
      requested_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('change_requests', ['application_id', 'status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('change_requests');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_change_requests_priority";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_change_requests_status";');
  },
};

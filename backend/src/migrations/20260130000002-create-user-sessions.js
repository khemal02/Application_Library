'use strict';

// Backs the Security tab's "Active Sessions" list. One row per issued JWT (identified by its
// `jti` claim) so a session can be individually revoked without invalidating every token via a
// secret rotation. `revoked_at` being null means the session is still valid; auth.middleware
// checks this for tokens that carry a jti.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_sessions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      jti: { type: Sequelize.STRING(64), allowNull: false },
      browser: { type: Sequelize.STRING(100) },
      os: { type: Sequelize.STRING(100) },
      device: { type: Sequelize.STRING(100) },
      ip_address: { type: Sequelize.STRING(60) },
      last_active_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      revoked_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('user_sessions', ['jti'], { unique: true, name: 'user_sessions_jti_unique' });
    await queryInterface.addIndex('user_sessions', ['user_id'], { name: 'user_sessions_user_id' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('user_sessions');
  },
};

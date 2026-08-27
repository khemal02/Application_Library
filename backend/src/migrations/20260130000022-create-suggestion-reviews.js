'use strict';

// Suggestions' own parallel review panel — same shape as idea_reviews (see migration
// 20260130000017), one verdict row per (suggestion, role slot). UNIQUE on
// (suggestion_id, role_name) is what makes "first eligible reviewer of a role fills that slot"
// true at the database level.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('suggestion_reviews', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      suggestion_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'application_suggestions', key: 'id' }, onDelete: 'CASCADE' },
      reviewer_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      role_name: { type: Sequelize.STRING(40), allowNull: false },
      decision: { type: Sequelize.ENUM('approve', 'request_changes', 'reject'), allowNull: false },
      note: { type: Sequelize.TEXT },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('suggestion_reviews', ['suggestion_id']);
    await queryInterface.addConstraint('suggestion_reviews', {
      fields: ['suggestion_id', 'role_name'],
      type: 'unique',
      name: 'suggestion_reviews_suggestion_id_role_name_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('suggestion_reviews');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_suggestion_reviews_decision";');
  },
};

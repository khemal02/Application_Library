'use strict';

// The parallel review panel: one verdict row per (idea, role slot). UNIQUE on (idea_id, role_name)
// is what makes "first eligible reviewer of a role fills that slot" true at the database level —
// a second person of the same role overwrites the row (upsert in the service layer) rather than
// adding a fourth one.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('idea_reviews', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      idea_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'ideas', key: 'id' }, onDelete: 'CASCADE' },
      reviewer_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      // Snapshot of which slot this verdict filled — a later role change for the reviewer must not
      // silently move an old verdict to a different slot.
      role_name: { type: Sequelize.STRING(40), allowNull: false },
      decision: { type: Sequelize.ENUM('approve', 'request_changes', 'reject'), allowNull: false },
      note: { type: Sequelize.TEXT },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('idea_reviews', ['idea_id']);
    await queryInterface.addConstraint('idea_reviews', {
      fields: ['idea_id', 'role_name'],
      type: 'unique',
      name: 'idea_reviews_idea_id_role_name_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('idea_reviews');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_idea_reviews_decision";');
  },
};

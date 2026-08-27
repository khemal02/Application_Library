'use strict';

// Extends the "New Idea" submission form: an auto-generated, human-friendly sequential number
// (idea_number — separate from the UUID primary key, which stays the real identity/FK target),
// plus Industry, Functional Area (both free-text-backed dropdowns, not DB enums, so the option
// list can change without a migration), and an Internal Use checkbox.
module.exports = {
  async up(queryInterface, Sequelize) {
    // Postgres has no ALTER COLUMN ... AUTO_INCREMENT — the standard way to bolt a serial onto an
    // existing table is a dedicated sequence + DEFAULT nextval(...), same effect as SERIAL.
    await queryInterface.sequelize.query('CREATE SEQUENCE IF NOT EXISTS ideas_idea_number_seq');
    await queryInterface.sequelize.query(
      `ALTER TABLE ideas ADD COLUMN idea_number INTEGER NOT NULL DEFAULT nextval('ideas_idea_number_seq')`,
    );
    await queryInterface.sequelize.query('ALTER SEQUENCE ideas_idea_number_seq OWNED BY ideas.idea_number');
    await queryInterface.addIndex('ideas', ['idea_number'], { unique: true });

    await queryInterface.addColumn('ideas', 'industry', { type: Sequelize.STRING(60), allowNull: true });
    await queryInterface.addColumn('ideas', 'functional_area', { type: Sequelize.STRING(60), allowNull: true });
    await queryInterface.addColumn('ideas', 'internal_use', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ideas', 'internal_use');
    await queryInterface.removeColumn('ideas', 'functional_area');
    await queryInterface.removeColumn('ideas', 'industry');
    await queryInterface.removeColumn('ideas', 'idea_number');
    await queryInterface.sequelize.query('DROP SEQUENCE IF EXISTS ideas_idea_number_seq');
  },
};

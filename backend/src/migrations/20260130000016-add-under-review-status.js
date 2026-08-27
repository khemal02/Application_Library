'use strict';

// Collapses the three sequential technical-review desks (technical_review_1, technical_review_2,
// review) into one parallel review gate: under_review. The old enum values are NOT removed —
// Postgres makes that painful, and status_history rows still reference them — this migration only
// adds the new value and moves in-flight new_idea rows forward onto it. existing_app_feature rows
// are left untouched; that lane keeps its current behaviour entirely.
module.exports = {
  async up(queryInterface) {
    // Must run as its own statement, not inside a transaction together with the UPDATE below —
    // Postgres forbids using a freshly-added enum value in the same transaction that added it.
    await queryInterface.sequelize.query("ALTER TYPE \"enum_ideas_status\" ADD VALUE IF NOT EXISTS 'under_review'");

    const [rows] = await queryInterface.sequelize.query(`
      UPDATE ideas SET status = 'under_review'
      WHERE category = 'new_idea' AND status IN ('technical_review_1', 'technical_review_2', 'review')
      RETURNING id
    `);
    // eslint-disable-next-line no-console
    console.log(`  -> moved ${rows.length} in-flight new_idea row(s) to under_review`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE ideas SET status = 'review'
      WHERE category = 'new_idea' AND status = 'under_review'
    `);
  },
};

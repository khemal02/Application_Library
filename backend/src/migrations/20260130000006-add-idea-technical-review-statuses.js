'use strict';

// Extends the idea workflow with two technical-review gates between Discussion and the final
// Review stage: Submitted -> Discussion -> Technical Review 1 -> Technical Review 2 -> Review ->
// Approved -> Development Ready. Postgres enum values can only be added, never removed in place,
// so down() is intentionally a no-op — no existing row can be using these values yet, so nothing
// is lost by leaving the enum labels in place on rollback.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query("ALTER TYPE \"enum_ideas_status\" ADD VALUE IF NOT EXISTS 'technical_review_1'");
    await queryInterface.sequelize.query("ALTER TYPE \"enum_ideas_status\" ADD VALUE IF NOT EXISTS 'technical_review_2'");
  },

  async down() {
    // Removing Postgres enum values requires recreating the type — not worth it for a dev rollback.
  },
};

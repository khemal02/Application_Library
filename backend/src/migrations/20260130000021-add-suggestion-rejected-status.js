'use strict';

// The new review panel (technical_review) needs a real rejection outcome, same as Ideas'
// under_review panel has (approved/discussion/rejected) — Suggestions had no such value before;
// every suggestion could only ever move forward or bounce back to discussion. Postgres enum
// values can't be removed, so `down` is a no-op — it's harmless to leave 'rejected' declared even
// if this migration is ever rolled back, as long as no row has been set to it (checked below).
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('ALTER TYPE "enum_application_suggestions_status" ADD VALUE IF NOT EXISTS \'rejected\'');
  },

  async down(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(
      "SELECT id FROM application_suggestions WHERE status = 'rejected'",
    );
    if (rows.length > 0) {
      throw new Error(`Cannot roll back: ${rows.length} suggestion(s) are already at 'rejected'. Move them to another status first.`);
    }
    // eslint-disable-next-line no-console
    console.log('  -> no suggestions at \'rejected\'; leaving the enum value in place (Postgres cannot drop enum values)');
  },
};

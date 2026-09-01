'use strict';

// Stage notes become real threaded entries in the existing polymorphic `comments` table
// (entityType: 'change_request_stage', entityId: the stage's id) instead of a single TEXT column —
// a column can't express "several notes, each with its own author and timestamp". Confirmed via
// direct query before writing this: 12/12 existing stage rows have a null/empty `notes` value, so
// this is a pure schema cleanup, not a data migration — the guard below still refuses to drop
// anything if that's ever not true when this actually runs.
module.exports = {
  async up(queryInterface, Sequelize) {
    const [[{ count }]] = await queryInterface.sequelize.query(
      "SELECT count(*)::int AS count FROM change_request_stages WHERE notes IS NOT NULL AND notes != ''",
    );
    if (count > 0) {
      throw new Error(
        `Refusing to drop change_request_stages.notes — ${count} row(s) still have a non-empty value. `
        + 'These would be silently discarded; back them up (e.g. as comments) before re-running this migration.',
      );
    }
    await queryInterface.removeColumn('change_request_stages', 'notes');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('change_request_stages', 'notes', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },
};

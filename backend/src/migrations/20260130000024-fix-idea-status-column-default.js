'use strict';

// The Postgres column-level DEFAULT for ideas.status has said 'submitted' since the table was
// created — Sequelize's model-level defaultValue (now 'under_review') is what every real INSERT
// through this app actually uses, since Sequelize always includes the column explicitly, so the
// column-level DEFAULT itself was never exercised. That was a harmless staleness while 'submitted'
// was merely retired (a real transition graph still routed a stray row somewhere reachable). It
// stopped being harmless the moment 'submitted' became unreachable AND unowned — there is no
// IDEA_STAGE_OWNERS anymore for a row stuck there to fall back on, and no transition graph to move
// it anywhere. Any INSERT that bypasses Sequelize's default injection (a raw migration, a bulk
// import, a future seeder) would now silently create an idea nobody can ever act on.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TABLE ideas ALTER COLUMN status SET DEFAULT 'under_review'::enum_ideas_status",
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TABLE ideas ALTER COLUMN status SET DEFAULT 'submitted'::enum_ideas_status",
    );
  },
};

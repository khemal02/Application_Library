'use strict';

// A genuinely separate "actual completion date" column for application_track_stages, distinct
// from end_date (shown as "Expected finish" — a manually-set target, never auto-touched). Before
// this, end_date was overloaded: it silently got auto-filled to today() the moment a stage
// completed if the owner had never set a target, which conflated "when we expect to finish" with
// "when we actually did." finished_date is set ONLY by the server, only when a stage's status
// moves to 'complete' (see applicationTracking.service.js#updateStage) — never user-submitted.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('application_track_stages', 'finished_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('application_track_stages', 'finished_date');
  },
};

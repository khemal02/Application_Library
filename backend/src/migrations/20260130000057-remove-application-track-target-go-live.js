'use strict';

// Drops the "Expected Deployment Date" field entirely, per explicit request — it's no longer
// collected (MoveToBuildDialog.jsx), displayed (ApplicationTrackingListPage/DetailPage.jsx), or
// enforced (the stage-date-window check in applicationTracking.service.js#updateStage) anywhere.
module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn('application_tracks', 'target_go_live');
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('application_tracks', 'target_go_live', {
      type: Sequelize.DATEONLY, allowNull: true,
    });
  },
};

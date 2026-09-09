'use strict';

// Development/Testing/Deployment stages (both Change Requests and Application Tracking share the
// identical stage shape — see changeRequestStage.model.js / applicationTrackStage.model.js) gain
// one plain field: an external document URL (e.g. a spec doc, test report, deployment runbook).
// Screenshots are handled separately, through the existing generic Attachment model
// (entityType 'change_request_stage' / 'application_track_stage', entityId the stage's own id) —
// no schema change needed there, since entityType is already free-form.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('change_request_stages', 'document_url', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
    await queryInterface.addColumn('application_track_stages', 'document_url', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('change_request_stages', 'document_url');
    await queryInterface.removeColumn('application_track_stages', 'document_url');
  },
};

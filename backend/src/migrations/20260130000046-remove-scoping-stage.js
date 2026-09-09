'use strict';

// Application Tracking's four stages are now three: Development -> Testing -> Deployment.
// Scoping is retired by explicit instruction. Same constraint documented throughout this
// codebase (e.g. 20260130000027-restrict-application-status.js) — Postgres can't drop an enum
// value, so 'scoping' stays defined on enum_application_track_stages_stage but unreachable from
// here on; the model/validator/service/frontend no longer offer or accept it (see
// applicationTrackStage.model.js, applicationTracking.validator.js, applicationTracking.
// service.js#STAGE_ORDER, ideas.service.js#finalizeIdea, applicationTrackStatus.js).
//
// Deletes every existing scoping stage row (and any comments/notes posted against one, since
// those are polymorphic — entityType 'application_track_stage' — with no real FK to catch them).
// down() re-seeds a blank not_started scoping row for every track that doesn't have one, mirroring
// how track creation originally seeded all four — it can't restore whatever assignee/dates/notes
// a deleted scoping row once had, only that scoping-the-stage exists again.
module.exports = {
  async up(queryInterface) {
    const [scopingRows] = await queryInterface.sequelize.query(
      "SELECT id FROM application_track_stages WHERE stage = 'scoping'",
    );
    const scopingIds = scopingRows.map((r) => r.id);
    if (scopingIds.length > 0) {
      await queryInterface.sequelize.query(
        "DELETE FROM comments WHERE entity_type = 'application_track_stage' AND entity_id = ANY(ARRAY[:ids]::uuid[])",
        { replacements: { ids: scopingIds } },
      );
      await queryInterface.sequelize.query(
        "DELETE FROM application_track_stages WHERE stage = 'scoping'",
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      INSERT INTO application_track_stages (id, application_track_id, stage, status, created_at, updated_at)
      SELECT gen_random_uuid(), t.id, 'scoping', 'not_started', now(), now()
      FROM application_tracks t
      WHERE NOT EXISTS (
        SELECT 1 FROM application_track_stages s
        WHERE s.application_track_id = t.id AND s.stage = 'scoping'
      )
    `);
  },
};

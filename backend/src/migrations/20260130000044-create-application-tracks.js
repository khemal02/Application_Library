'use strict';

const ts = (Sequelize) => ({
  createdAt: { type: Sequelize.DATE, allowNull: false, field: 'created_at', defaultValue: Sequelize.NOW },
  updatedAt: { type: Sequelize.DATE, allowNull: false, field: 'updated_at', defaultValue: Sequelize.NOW },
});

const id = (Sequelize) => ({
  id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
});

const ENUM_TYPES = [
  'enum_application_tracks_priority',
  'enum_application_tracks_status',
  'enum_application_track_stages_stage',
  'enum_application_track_stages_status',
];

// Application Tracking — a track is an approved idea being built. See ideas.service.js#finalizeIdea
// (Stage 2a of the RICC prompt, not yet wired here) for where a track gets created, and
// changeRequests.service.js#updateStage for the pattern application_track_stages copies (this
// module deliberately doesn't import from there — see D5/D6 in the discovery report: STAGE_ORDER/
// STAGE_LABELS aren't exported, so nothing is actually shareable).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('application_tracks', {
      ...id(Sequelize),
      // NOT NULL + UNIQUE — one idea produces exactly one track, enforced by the database, not just
      // application code (see V2 in the verification plan).
      idea_id: {
        type: Sequelize.UUID, allowNull: false, unique: true,
        references: { model: 'ideas', key: 'id' }, onDelete: 'RESTRICT',
      },
      // Nullable override — falls back to the idea's own title/description when unset (see
      // applicationTracking.service.js#resolveTrack, mirroring changeRequests.service.js's
      // resolveSource()). A track always has a source idea, so unlike change_requests there's no
      // CHECK constraint needed here.
      name: { type: Sequelize.STRING(200), allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      priority: {
        type: Sequelize.ENUM('critical', 'high', 'medium', 'low'), allowNull: false, defaultValue: 'medium',
      },
      status: {
        type: Sequelize.ENUM('active', 'on_hold', 'live', 'cancelled'), allowNull: false, defaultValue: 'active',
      },
      owner_id: {
        type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL',
      },
      target_go_live: { type: Sequelize.DATEONLY, allowNull: true },
      // Set only at go-live (Stage 2b, not yet wired here) — null for the entire life of the track
      // until Deployment completes.
      application_id: {
        type: Sequelize.UUID, allowNull: true, references: { model: 'applications', key: 'id' }, onDelete: 'SET NULL',
      },
      closure_reason: { type: Sequelize.TEXT, allowNull: true },
      closed_at: { type: Sequelize.DATEONLY, allowNull: true },
      ...ts(Sequelize),
    });
    await queryInterface.addIndex('application_tracks', ['status', 'priority']);

    await queryInterface.createTable('application_track_stages', {
      ...id(Sequelize),
      application_track_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'application_tracks', key: 'id' }, onDelete: 'CASCADE',
      },
      stage: {
        type: Sequelize.ENUM('scoping', 'development', 'testing', 'deployment'), allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('not_started', 'in_progress', 'complete'), allowNull: false, defaultValue: 'not_started',
      },
      assignee_id: {
        type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL',
      },
      start_date: { type: Sequelize.DATEONLY, allowNull: true },
      end_date: { type: Sequelize.DATEONLY, allowNull: true },
      ...ts(Sequelize),
    });
    await queryInterface.addIndex(
      'application_track_stages', ['application_track_id', 'stage'],
      { unique: true, name: 'application_track_stages_track_id_stage_unique' },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('application_track_stages');
    await queryInterface.dropTable('application_tracks');
    for (const enumType of ENUM_TYPES) {
      await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "${enumType}";`);
    }
  },
};

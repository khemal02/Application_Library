'use strict';

// The Issues -> Change Request bridge (Stage 3 of the Issues RICC prompt) — sits alongside the
// existing `feature_request_id` column added in 20260130000035, and the pre-existing (unused)
// `idea_id` column. Same shape as feature_request_id: nullable, SET NULL on delete — a deleted
// issue does not have to take its (already-approved, in-flight) change request down with it.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('change_requests', 'issue_id', {
      type: Sequelize.UUID, allowNull: true,
      references: { model: 'issues', key: 'id' }, onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('change_requests', 'issue_id');
  },
};

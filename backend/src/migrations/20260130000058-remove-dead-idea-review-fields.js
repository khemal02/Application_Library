'use strict';

// Removes columns confirmed dead by a full-codebase audit (grepped every service/controller/
// validator/frontend page — no reads or writes anywhere outside their own model definition) and
// confirmed empty in the live database (0 non-null rows; estimated_complexity's non-null count was
// just its column default firing, never an intentional value) before this repo ships as a fresh
// HRMS-integration base. See conversation history for the audit — not worth re-deriving in a
// comment here.
const IDEA_FEATURE_TEXT_COLUMNS = [
  'business_problem', 'expected_benefits', 'ai_usage', 'technology_suggestion', 'target_users', 'estimated_dev_time',
];

module.exports = {
  async up(queryInterface, Sequelize) {
    for (const table of ['ideas', 'feature_requests']) {
      for (const column of IDEA_FEATURE_TEXT_COLUMNS) {
        await queryInterface.removeColumn(table, column);
      }
      await queryInterface.removeColumn(table, 'estimated_complexity');
    }
    // Auto-created by Sequelize per-column/per-table — orphaned once both estimated_complexity
    // columns are gone, nothing else references either type name.
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ideas_estimated_complexity";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_feature_requests_estimated_complexity";');

    // ideas-only: the pre-panel single-reviewer-claim columns (assignReviewer()/PATCH
    // /ideas/:id/reviewer) — deleted along with the rest of the old stage machine.
    await queryInterface.removeColumn('ideas', 'reviewer_id');
    await queryInterface.removeColumn('ideas', 'review_notes');
    await queryInterface.removeColumn('ideas', 'reviewer_feedback');

    // idea_reviews: the legacy team_lead/manager/ceo-chain snapshot columns. Confirmed 0 non-null
    // rows in the live DB, so the "7 backfilled legacy rows" the model comment describes don't
    // exist here — safe to drop outright rather than needing to preserve them.
    await queryInterface.removeColumn('idea_reviews', 'reviewer_id');
    await queryInterface.removeColumn('idea_reviews', 'role_name');
  },

  async down(queryInterface, Sequelize) {
    for (const table of ['ideas', 'feature_requests']) {
      await queryInterface.addColumn(table, 'business_problem', { type: Sequelize.TEXT });
      await queryInterface.addColumn(table, 'expected_benefits', { type: Sequelize.TEXT });
      await queryInterface.addColumn(table, 'ai_usage', { type: Sequelize.TEXT });
      await queryInterface.addColumn(table, 'technology_suggestion', { type: Sequelize.TEXT });
      await queryInterface.addColumn(table, 'target_users', { type: Sequelize.STRING(300) });
      await queryInterface.addColumn(table, 'estimated_dev_time', { type: Sequelize.STRING(60) });
      await queryInterface.addColumn(table, 'estimated_complexity', {
        type: Sequelize.ENUM('low', 'medium', 'high'), defaultValue: 'medium',
      });
    }

    await queryInterface.addColumn('ideas', 'reviewer_id', {
      type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('ideas', 'review_notes', { type: Sequelize.TEXT });
    await queryInterface.addColumn('ideas', 'reviewer_feedback', { type: Sequelize.TEXT });

    await queryInterface.addColumn('idea_reviews', 'reviewer_id', {
      type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('idea_reviews', 'role_name', { type: Sequelize.STRING(40) });
  },
};

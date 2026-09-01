'use strict';

// Splits "Modify Current Application" (ideas.category = 'existing_app_feature') out of the
// `ideas` table into its own `feature_requests` table, with its own `feature_request_reviews`
// review-panel table — per explicit instruction to make the two modules fully independent, not
// just two list pages sharing one backend. IDs are preserved across the move (a feature request
// keeps the same UUID it had as an idea), so every existing URL/reference/bookmark by id keeps
// working; what moves is the row's home table, its polymorphic entityType tag on
// comments/votes/status_history, and its notification links.
//
// The exact 7 rows this touches were identified at authoring time (see the project report) and
// are hardcoded below — this is a one-time, specific-dataset migration, not a generic reusable
// one, same convention as 20260130000033's TOUCHED_IDS.
const MOVED_IDS = [
  'e57bd66f-7f2a-453e-8f3d-72691b9cf712',
  '46a025e9-0553-4bcf-b404-320a2af8dcb0',
  'dcbbb5bb-b4db-4ded-a2c5-a41d6f73c959',
  '1c7468a9-2b9a-4bed-8b1b-bb1be599b602',
  '4258a899-40eb-4ccc-9c12-ca3815ed883d',
  '46aaca6c-1c78-4ed7-ac0e-9b7a20b383e9',
  '3e4653ea-5eac-4801-89cf-345d72c6570b',
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1. New table — same shape as `ideas`, minus the dead reviewerId/reviewNotes/
      // reviewerFeedback columns (confirmed empty for all 7 moved rows), applicationId now
      // NOT NULL (every feature request always has one).
      await queryInterface.createTable('feature_requests', {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        requestNumber: {
          field: 'request_number', type: Sequelize.INTEGER, allowNull: false, autoIncrement: true,
        },
        title: { type: Sequelize.STRING(200), allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: false },
        industry: { type: Sequelize.STRING(60), allowNull: true },
        functionalArea: { field: 'functional_area', type: Sequelize.STRING(60), allowNull: true },
        internalUse: {
          field: 'internal_use', type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false,
        },
        applicationId: {
          field: 'application_id', type: Sequelize.UUID, allowNull: false,
          references: { model: 'applications', key: 'id' }, onDelete: 'CASCADE',
        },
        businessProblem: { field: 'business_problem', type: Sequelize.TEXT },
        proposedSolution: { field: 'proposed_solution', type: Sequelize.TEXT },
        expectedBenefits: { field: 'expected_benefits', type: Sequelize.TEXT },
        aiUsage: { field: 'ai_usage', type: Sequelize.TEXT },
        technologySuggestion: { field: 'technology_suggestion', type: Sequelize.TEXT },
        technologiesAndEfficiency: { field: 'technologies_and_efficiency', type: Sequelize.TEXT },
        departmentId: {
          field: 'department_id', type: Sequelize.UUID, allowNull: true,
          references: { model: 'departments', key: 'id' }, onDelete: 'SET NULL',
        },
        targetUsers: { field: 'target_users', type: Sequelize.STRING(300) },
        estimatedComplexity: {
          field: 'estimated_complexity', type: Sequelize.ENUM('low', 'medium', 'high'), defaultValue: 'medium',
        },
        estimatedDevTime: { field: 'estimated_dev_time', type: Sequelize.STRING(60) },
        status: {
          type: Sequelize.ENUM('under_review', 'approved', 'rejected'), allowNull: false, defaultValue: 'under_review',
        },
        priority: {
          type: Sequelize.ENUM('low', 'medium', 'high', 'critical'), allowNull: false, defaultValue: 'medium',
        },
        submittedBy: {
          field: 'submitted_by', type: Sequelize.UUID, allowNull: false,
          references: { model: 'users', key: 'id' }, onDelete: 'CASCADE',
        },
        searchVector: { field: 'search_vector', type: Sequelize.TSVECTOR },
        createdAt: { field: 'created_at', type: Sequelize.DATE, allowNull: false },
        updatedAt: { field: 'updated_at', type: Sequelize.DATE, allowNull: false },
      }, { transaction });
      await queryInterface.sequelize.query(
        'CREATE SEQUENCE IF NOT EXISTS feature_requests_request_number_seq OWNED BY feature_requests.request_number',
        { transaction },
      );
      await queryInterface.addIndex('feature_requests', ['status'], { transaction });
      await queryInterface.addIndex('feature_requests', ['submitted_by'], { transaction });
      await queryInterface.addIndex('feature_requests', ['application_id'], { transaction });
      await queryInterface.addIndex('feature_requests', ['search_vector'], { using: 'GIN', transaction });

      // 2. New review-panel table — same shape as idea_reviews, minus the legacy reviewer_id/
      // role_name columns (that backfill was specific to the old ideas chain and confirmed empty
      // for every review row being moved here).
      await queryInterface.createTable('feature_request_reviews', {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        featureRequestId: {
          field: 'feature_request_id', type: Sequelize.UUID, allowNull: false,
          references: { model: 'feature_requests', key: 'id' }, onDelete: 'CASCADE',
        },
        userId: {
          field: 'user_id', type: Sequelize.UUID, allowNull: false,
          references: { model: 'users', key: 'id' }, onDelete: 'CASCADE',
        },
        kind: { type: Sequelize.STRING(20), allowNull: false },
        addedBy: {
          field: 'added_by', type: Sequelize.UUID, allowNull: true,
          references: { model: 'users', key: 'id' }, onDelete: 'SET NULL',
        },
        addedAt: { field: 'added_at', type: Sequelize.DATE, allowNull: true },
        decision: { type: Sequelize.ENUM('approve', 'request_changes', 'reject'), allowNull: true },
        note: { type: Sequelize.TEXT },
        createdAt: { field: 'created_at', type: Sequelize.DATE, allowNull: false },
        updatedAt: { field: 'updated_at', type: Sequelize.DATE, allowNull: false },
      }, { transaction });
      await queryInterface.addIndex('feature_request_reviews', ['feature_request_id'], { transaction });
      await queryInterface.addConstraint('feature_request_reviews', {
        fields: ['feature_request_id', 'user_id'], type: 'unique', name: 'feature_request_reviews_fr_id_user_id_unique', transaction,
      });

      // 3. The Ideas -> Change Request bridge's FK, mirrored for feature requests. `idea_id`
      // stays on change_requests for any pre-move data (there is none live today — checked before
      // writing this migration — but the column itself is untouched either way).
      await queryInterface.addColumn('change_requests', 'feature_request_id', {
        type: Sequelize.UUID, allowNull: true,
        references: { model: 'feature_requests', key: 'id' }, onDelete: 'SET NULL',
      }, { transaction });

      // 4. Move the 7 rows: ideas -> feature_requests (ids preserved).
      await queryInterface.sequelize.query(`
        INSERT INTO feature_requests (
          id, request_number, title, description, industry, functional_area, internal_use,
          application_id, business_problem, proposed_solution, expected_benefits, ai_usage,
          technology_suggestion, technologies_and_efficiency, department_id, target_users,
          estimated_complexity, estimated_dev_time, status, priority, submitted_by, search_vector,
          created_at, updated_at
        )
        SELECT
          id, idea_number, title, description, industry, functional_area, internal_use,
          application_id, business_problem, proposed_solution, expected_benefits, ai_usage,
          technology_suggestion, technologies_and_efficiency, department_id, target_users,
          estimated_complexity::text::enum_feature_requests_estimated_complexity, estimated_dev_time,
          status::text::enum_feature_requests_status, priority::text::enum_feature_requests_priority,
          submitted_by, search_vector, created_at, updated_at
        FROM ideas WHERE id IN (:ids)
      `, { replacements: { ids: MOVED_IDS }, transaction });
      await queryInterface.sequelize.query(
        `SELECT setval('feature_requests_request_number_seq', (SELECT MAX(request_number) FROM feature_requests))`,
        { transaction },
      );

      // 5. Move their review rows: idea_reviews -> feature_request_reviews.
      await queryInterface.sequelize.query(`
        INSERT INTO feature_request_reviews (
          id, feature_request_id, user_id, kind, added_by, added_at, decision, note, created_at, updated_at
        )
        SELECT id, idea_id, user_id, kind, added_by, added_at,
          decision::text::enum_feature_request_reviews_decision, note, created_at, updated_at
        FROM idea_reviews WHERE idea_id IN (:ids)
      `, { replacements: { ids: MOVED_IDS }, transaction });

      // 6. Re-tag polymorphic rows (comments, votes, status_history) from entityType 'idea' to
      // 'feature_request', scoped to only these 7 ids — attachments never reference an idea/
      // feature-request directly (always entityType:'comment'), so they need no change; taggables
      // has 0 rows for these ids today but is included for correctness.
      await queryInterface.sequelize.query(
        `UPDATE comments SET entity_type = 'feature_request' WHERE entity_type = 'idea' AND entity_id IN (:ids)`,
        { replacements: { ids: MOVED_IDS }, transaction },
      );
      await queryInterface.sequelize.query(
        `UPDATE votes SET entity_type = 'feature_request' WHERE entity_type = 'idea' AND entity_id IN (:ids)`,
        { replacements: { ids: MOVED_IDS }, transaction },
      );
      await queryInterface.sequelize.query(
        `UPDATE taggables SET entity_type = 'feature_request' WHERE entity_type = 'idea' AND entity_id IN (:ids)`,
        { replacements: { ids: MOVED_IDS }, transaction },
      );
      await queryInterface.sequelize.query(
        `UPDATE status_history SET entity_type = 'feature_request' WHERE entity_type = 'idea' AND entity_id IN (:ids)`,
        { replacements: { ids: MOVED_IDS }, transaction },
      );

      // 7. Re-point notification links from /ideas/{id} to /feature-requests/{id} for these ids
      // only (this also fixes a real pre-existing bug: these links were always /ideas/{id} even
      // for a feature request — masked only because both routes rendered the same component).
      for (const id of MOVED_IDS) {
        await queryInterface.sequelize.query(
          `UPDATE notifications SET link = REPLACE(link, :oldPrefix, :newPrefix) WHERE link LIKE :pattern`,
          {
            replacements: { oldPrefix: `/ideas/${id}`, newPrefix: `/feature-requests/${id}`, pattern: `/ideas/${id}%` },
            transaction,
          },
        );
      }

      // 8. Remove the moved rows from `ideas` — idea_reviews cascades automatically (real FK,
      // ON DELETE CASCADE), same as any other idea deletion.
      await queryInterface.sequelize.query('DELETE FROM ideas WHERE id IN (:ids)', { replacements: { ids: MOVED_IDS }, transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Reverse order: restore the 7 rows to `ideas` before dropping the tables they live in now.
      await queryInterface.sequelize.query(`
        INSERT INTO ideas (
          id, idea_number, title, description, industry, functional_area, internal_use, category,
          application_id, business_problem, proposed_solution, expected_benefits, ai_usage,
          technology_suggestion, technologies_and_efficiency, department_id, target_users,
          estimated_complexity, estimated_dev_time, status, priority, submitted_by, search_vector,
          created_at, updated_at
        )
        SELECT
          id, request_number, title, description, industry, functional_area, internal_use,
          'existing_app_feature', application_id, business_problem, proposed_solution,
          expected_benefits, ai_usage, technology_suggestion, technologies_and_efficiency,
          department_id, target_users, estimated_complexity::text::enum_ideas_estimated_complexity,
          estimated_dev_time, status::text::enum_ideas_status, priority::text::enum_ideas_priority,
          submitted_by, search_vector, created_at, updated_at
        FROM feature_requests WHERE id IN (:ids)
      `, { replacements: { ids: MOVED_IDS }, transaction });
      await queryInterface.sequelize.query(
        `SELECT setval('ideas_idea_number_seq', (SELECT MAX(idea_number) FROM ideas))`,
        { transaction },
      );

      await queryInterface.sequelize.query(`
        INSERT INTO idea_reviews (id, idea_id, user_id, kind, added_by, added_at, decision, note, created_at, updated_at)
        SELECT id, feature_request_id, user_id, kind, added_by, added_at,
          decision::text::enum_idea_reviews_decision, note, created_at, updated_at
        FROM feature_request_reviews WHERE feature_request_id IN (:ids)
      `, { replacements: { ids: MOVED_IDS }, transaction });

      await queryInterface.sequelize.query(
        `UPDATE comments SET entity_type = 'idea' WHERE entity_type = 'feature_request' AND entity_id IN (:ids)`,
        { replacements: { ids: MOVED_IDS }, transaction },
      );
      await queryInterface.sequelize.query(
        `UPDATE votes SET entity_type = 'idea' WHERE entity_type = 'feature_request' AND entity_id IN (:ids)`,
        { replacements: { ids: MOVED_IDS }, transaction },
      );
      await queryInterface.sequelize.query(
        `UPDATE taggables SET entity_type = 'idea' WHERE entity_type = 'feature_request' AND entity_id IN (:ids)`,
        { replacements: { ids: MOVED_IDS }, transaction },
      );
      await queryInterface.sequelize.query(
        `UPDATE status_history SET entity_type = 'idea' WHERE entity_type = 'feature_request' AND entity_id IN (:ids)`,
        { replacements: { ids: MOVED_IDS }, transaction },
      );
      for (const id of MOVED_IDS) {
        await queryInterface.sequelize.query(
          `UPDATE notifications SET link = REPLACE(link, :oldPrefix, :newPrefix) WHERE link LIKE :pattern`,
          {
            replacements: { oldPrefix: `/feature-requests/${id}`, newPrefix: `/ideas/${id}`, pattern: `/feature-requests/${id}%` },
            transaction,
          },
        );
      }

      await queryInterface.removeColumn('change_requests', 'feature_request_id', { transaction });
      await queryInterface.dropTable('feature_request_reviews', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_feature_request_reviews_decision";', { transaction });
      await queryInterface.dropTable('feature_requests', { transaction });
      await queryInterface.sequelize.query('DROP SEQUENCE IF EXISTS feature_requests_request_number_seq', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_feature_requests_estimated_complexity";', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_feature_requests_status";', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_feature_requests_priority";', { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};

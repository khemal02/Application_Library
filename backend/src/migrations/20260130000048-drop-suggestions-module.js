'use strict';

// The Suggestions module (application_suggestions + its suggestion_reviews review panel) is
// unused and being removed entirely — model files, the whole modules/suggestions/ folder, and
// every frontend page/nav entry are deleted alongside this migration (see the matching frontend/
// backend PR). This migration is the database half:
//   1. Purge every polymorphic row (comments, their attachments, votes, tags, status history,
//      notifications) that references a 'suggestion' or 'suggestion_note' entityType — the same
//      cleanup suggestions.service.js#remove already did per-record via cleanupEntityRefs(), done
//      here in bulk since the whole table is going away at once, not one row at a time.
//   2. Delete the 'suggestions' resource's role_permissions grants (mirrors the technique
//      20260130000004-remove-employee-review-permission.js already used for a narrower case).
//   3. Drop suggestion_reviews (the child, has the FK) then application_suggestions, then their
//      enum types (Postgres can't drop enum values, only whole types, once nothing references them).
//
// down() restores the final-state schema (both tables as they existed just before this migration,
// matching applicationSuggestion.model.js/suggestionReview.model.js) and re-grants the same
// role_permissions rows — but it cannot bring back the deleted comments/votes/tags/notifications
// rows or any suggestion data itself; like every table-drop migration in this codebase
// (20260130000043 is the precedent), down() undoes the schema, not the lost rows.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM attachments WHERE entity_type = 'comment' AND entity_id IN (
        SELECT id FROM comments WHERE entity_type IN ('suggestion', 'suggestion_note')
      );
    `);
    await queryInterface.sequelize.query(
      "DELETE FROM comments WHERE entity_type IN ('suggestion', 'suggestion_note');",
    );
    await queryInterface.sequelize.query(
      "DELETE FROM votes WHERE entity_type IN ('suggestion', 'suggestion_note');",
    );
    await queryInterface.sequelize.query(
      "DELETE FROM taggables WHERE entity_type IN ('suggestion', 'suggestion_note');",
    );
    await queryInterface.sequelize.query(
      "DELETE FROM status_history WHERE entity_type IN ('suggestion', 'suggestion_note');",
    );
    await queryInterface.sequelize.query(
      "DELETE FROM notifications WHERE link LIKE '/suggestions/%';",
    );
    await queryInterface.sequelize.query(
      "DELETE FROM role_permissions WHERE resource = 'suggestions';",
    );

    await queryInterface.dropTable('suggestion_reviews');
    await queryInterface.dropTable('application_suggestions');

    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_suggestion_reviews_decision";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_application_suggestions_priority";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_application_suggestions_status";');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.createTable('application_suggestions', {
      id: {
        type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false,
      },
      application_id: {
        type: Sequelize.UUID, allowNull: false, references: { model: 'applications', key: 'id' }, onDelete: 'CASCADE',
      },
      department_id: {
        type: Sequelize.UUID, allowNull: true, references: { model: 'departments', key: 'id' }, onDelete: 'SET NULL',
      },
      functional_area: { type: Sequelize.STRING(60), allowNull: true },
      title: { type: Sequelize.STRING(200), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: false },
      current_problem: { type: Sequelize.TEXT },
      suggested_solution: { type: Sequelize.TEXT },
      expected_benefit: { type: Sequelize.TEXT },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'critical'), allowNull: false, defaultValue: 'medium',
      },
      module: { type: Sequelize.STRING(120) },
      status: {
        type: Sequelize.ENUM('submitted', 'technical_review', 'discussion', 'approved', 'assigned', 'implemented', 'closed', 'rejected'),
        allowNull: false,
        defaultValue: 'submitted',
      },
      assigned_to: {
        type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL',
      },
      submitted_by: {
        type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE',
      },
      search_vector: { type: Sequelize.TSVECTOR },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('application_suggestions', ['application_id', 'status']);
    await queryInterface.addIndex('application_suggestions', ['submitted_by']);
    await queryInterface.addIndex('application_suggestions', ['search_vector'], { using: 'GIN', name: 'application_suggestions_search_vector_gin' });

    await queryInterface.createTable('suggestion_reviews', {
      id: {
        type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false,
      },
      suggestion_id: {
        type: Sequelize.UUID, allowNull: false, references: { model: 'application_suggestions', key: 'id' }, onDelete: 'CASCADE',
      },
      reviewer_id: {
        type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL',
      },
      role_name: { type: Sequelize.STRING(40), allowNull: false },
      decision: { type: Sequelize.ENUM('approve', 'request_changes', 'reject'), allowNull: false },
      note: { type: Sequelize.TEXT },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('suggestion_reviews', ['suggestion_id']);
    await queryInterface.addConstraint('suggestion_reviews', {
      fields: ['suggestion_id', 'role_name'],
      type: 'unique',
      name: 'suggestion_reviews_suggestion_id_role_name_unique',
    });

    const { v4: uuidv4 } = require('uuid');
    const [roles] = await queryInterface.sequelize.query("SELECT id, name FROM roles WHERE name IN ('ceo', 'manager', 'team_lead', 'employee')");
    const roleId = (name) => roles.find((r) => r.name === name)?.id;
    const now = new Date();
    const rows = [];
    const grant = (roleName, actions) => {
      const id = roleId(roleName);
      if (!id) return;
      actions.forEach((action) => rows.push({
        id: uuidv4(), role_id: id, resource: 'suggestions', action, created_at: now, updated_at: now,
      }));
    };
    grant('ceo', ['manage']);
    grant('manager', ['manage']);
    grant('team_lead', ['create', 'read', 'review', 'update', 'assign']);
    grant('employee', ['create', 'read', 'update']);
    if (rows.length) await queryInterface.bulkInsert('role_permissions', rows);
  },
};

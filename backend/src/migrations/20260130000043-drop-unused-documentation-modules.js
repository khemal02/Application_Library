'use strict';

// Ten sub-resource "documentation" tables that were never actually reachable from any current UI
// path — ApplicationDetailPage.jsx only renders the info panel, Change Requests, and Issues. The
// shared component they rendered through (SubResourceTab.jsx) has zero importers left. Confirmed
// before writing this migration: no comment/vote/attachment row references any of these entity
// types, and feature_dependencies has 0 rows — nothing else in the system touches this data.
// down() recreates every table/index exactly as 20260101000001-initial-schema.js defined them, so
// this is fully reversible (though any rows added between up() and a rollback are still lost —
// dropping a table is not a no-op, the schema comes back empty).
const ts = (Sequelize) => ({
  createdAt: { type: Sequelize.DATE, allowNull: false, field: 'created_at', defaultValue: Sequelize.NOW },
  updatedAt: { type: Sequelize.DATE, allowNull: false, field: 'updated_at', defaultValue: Sequelize.NOW },
});

const id = (Sequelize) => ({
  id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
});

const ENUM_TYPES = [
  'enum_application_tech_stack_category',
  'enum_application_features_status',
  'enum_architecture_docs_doc_type',
  'enum_api_endpoints_method',
  'enum_bug_history_severity', 'enum_bug_history_status',
  'enum_roadmap_items_status', 'enum_roadmap_items_priority',
  'enum_timeline_milestones_status',
];

module.exports = {
  async up(queryInterface) {
    // Child table first (references application_features).
    await queryInterface.dropTable('feature_dependencies');
    await queryInterface.dropTable('application_features');
    await queryInterface.dropTable('application_tech_stack');
    await queryInterface.dropTable('ai_prompts');
    await queryInterface.dropTable('architecture_docs');
    await queryInterface.dropTable('api_endpoints');
    await queryInterface.dropTable('db_table_docs');
    await queryInterface.dropTable('release_notes');
    await queryInterface.dropTable('bug_history');
    await queryInterface.dropTable('roadmap_items');
    await queryInterface.dropTable('timeline_milestones');

    // Postgres ENUM types survive dropTable and must be dropped explicitly, same as
    // 20260101000001-initial-schema.js's own down() does.
    for (const enumType of ENUM_TYPES) {
      await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "${enumType}";`);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.createTable('application_tech_stack', {
      ...id(Sequelize),
      application_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'applications', key: 'id' }, onDelete: 'CASCADE' },
      category: { type: Sequelize.ENUM('frontend', 'backend', 'database', 'ai_model', 'framework', 'library', 'cloud', 'devops'), allowNull: false },
      name: { type: Sequelize.STRING(120), allowNull: false },
      version: { type: Sequelize.STRING(40) },
      notes: { type: Sequelize.TEXT },
      ...ts(Sequelize),
    });
    await queryInterface.addIndex('application_tech_stack', ['application_id', 'category']);

    await queryInterface.createTable('application_features', {
      ...id(Sequelize),
      application_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'applications', key: 'id' }, onDelete: 'CASCADE' },
      name: { type: Sequelize.STRING(200), allowNull: false },
      description: { type: Sequelize.TEXT },
      status: { type: Sequelize.ENUM('planned', 'in_progress', 'completed', 'blocked'), allowNull: false, defaultValue: 'planned' },
      assigned_developer_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      estimated_time: { type: Sequelize.STRING(60) },
      completion_date: { type: Sequelize.DATEONLY },
      ...ts(Sequelize),
    });
    await queryInterface.addIndex('application_features', ['application_id', 'status']);

    await queryInterface.createTable('feature_dependencies', {
      ...id(Sequelize),
      feature_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'application_features', key: 'id' }, onDelete: 'CASCADE' },
      depends_on_feature_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'application_features', key: 'id' }, onDelete: 'CASCADE' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('feature_dependencies', ['feature_id', 'depends_on_feature_id'], { unique: true, name: 'feature_dependencies_unique' });

    await queryInterface.createTable('ai_prompts', {
      ...id(Sequelize),
      application_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'applications', key: 'id' }, onDelete: 'CASCADE' },
      title: { type: Sequelize.STRING(200), allowNull: false },
      prompt_text: { type: Sequelize.TEXT, allowNull: false },
      prompt_type: { type: Sequelize.STRING(60) },
      ai_model: { type: Sequelize.STRING(80) },
      output_summary: { type: Sequelize.TEXT },
      version: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'v1' },
      created_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      search_vector: { type: Sequelize.TSVECTOR },
      ...ts(Sequelize),
    });
    await queryInterface.addIndex('ai_prompts', ['application_id']);
    await queryInterface.addIndex('ai_prompts', ['search_vector'], { using: 'GIN', name: 'ai_prompts_search_vector_gin' });

    await queryInterface.createTable('architecture_docs', {
      ...id(Sequelize),
      application_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'applications', key: 'id' }, onDelete: 'CASCADE' },
      doc_type: { type: Sequelize.ENUM('high_level', 'folder_structure', 'api_flow', 'db_design', 'auth_flow', 'microservice_diagram', 'deployment_diagram'), allowNull: false },
      title: { type: Sequelize.STRING(200) },
      content_markdown: { type: Sequelize.TEXT },
      diagram_url: { type: Sequelize.STRING(500) },
      updated_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      ...ts(Sequelize),
    });
    await queryInterface.addIndex('architecture_docs', ['application_id', 'doc_type'], { unique: true, name: 'architecture_docs_app_doctype_unique' });

    await queryInterface.createTable('api_endpoints', {
      ...id(Sequelize),
      application_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'applications', key: 'id' }, onDelete: 'CASCADE' },
      endpoint: { type: Sequelize.STRING(300), allowNull: false },
      method: { type: Sequelize.ENUM('GET', 'POST', 'PUT', 'PATCH', 'DELETE'), allowNull: false },
      description: { type: Sequelize.TEXT },
      request_schema: { type: Sequelize.JSONB },
      response_schema: { type: Sequelize.JSONB },
      error_codes: { type: Sequelize.JSONB },
      ...ts(Sequelize),
    });
    await queryInterface.addIndex('api_endpoints', ['application_id']);

    await queryInterface.createTable('db_table_docs', {
      ...id(Sequelize),
      application_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'applications', key: 'id' }, onDelete: 'CASCADE' },
      table_name: { type: Sequelize.STRING(120), allowNull: false },
      description: { type: Sequelize.TEXT },
      columns: { type: Sequelize.JSONB },
      relationships: { type: Sequelize.JSONB },
      constraints: { type: Sequelize.JSONB },
      ...ts(Sequelize),
    });
    await queryInterface.addIndex('db_table_docs', ['application_id']);

    await queryInterface.createTable('release_notes', {
      ...id(Sequelize),
      application_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'applications', key: 'id' }, onDelete: 'CASCADE' },
      version: { type: Sequelize.STRING(30), allowNull: false },
      release_date: { type: Sequelize.DATEONLY },
      new_features: { type: Sequelize.ARRAY(Sequelize.TEXT), defaultValue: [] },
      bug_fixes: { type: Sequelize.ARRAY(Sequelize.TEXT), defaultValue: [] },
      breaking_changes: { type: Sequelize.ARRAY(Sequelize.TEXT), defaultValue: [] },
      created_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      ...ts(Sequelize),
    });
    await queryInterface.addIndex('release_notes', ['application_id', 'version'], { unique: true, name: 'release_notes_app_version_unique' });

    await queryInterface.createTable('bug_history', {
      ...id(Sequelize),
      application_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'applications', key: 'id' }, onDelete: 'CASCADE' },
      title: { type: Sequelize.STRING(200), allowNull: false },
      description: { type: Sequelize.TEXT },
      severity: { type: Sequelize.ENUM('low', 'medium', 'high', 'critical'), allowNull: false, defaultValue: 'medium' },
      status: { type: Sequelize.ENUM('open', 'in_progress', 'resolved', 'wont_fix'), allowNull: false, defaultValue: 'open' },
      reported_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      resolved_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      reported_date: { type: Sequelize.DATEONLY },
      resolved_date: { type: Sequelize.DATEONLY },
      ...ts(Sequelize),
    });
    await queryInterface.addIndex('bug_history', ['application_id', 'status']);

    await queryInterface.createTable('roadmap_items', {
      ...id(Sequelize),
      application_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'applications', key: 'id' }, onDelete: 'CASCADE' },
      title: { type: Sequelize.STRING(200), allowNull: false },
      description: { type: Sequelize.TEXT },
      target_quarter: { type: Sequelize.STRING(20) },
      status: { type: Sequelize.ENUM('proposed', 'planned', 'in_progress', 'done'), allowNull: false, defaultValue: 'proposed' },
      priority: { type: Sequelize.ENUM('low', 'medium', 'high', 'critical'), allowNull: false, defaultValue: 'medium' },
      ...ts(Sequelize),
    });
    await queryInterface.addIndex('roadmap_items', ['application_id', 'status']);

    await queryInterface.createTable('timeline_milestones', {
      ...id(Sequelize),
      application_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'applications', key: 'id' }, onDelete: 'CASCADE' },
      title: { type: Sequelize.STRING(200), allowNull: false },
      description: { type: Sequelize.TEXT },
      due_date: { type: Sequelize.DATEONLY },
      status: { type: Sequelize.ENUM('upcoming', 'in_progress', 'completed', 'delayed'), allowNull: false, defaultValue: 'upcoming' },
      ...ts(Sequelize),
    });
    await queryInterface.addIndex('timeline_milestones', ['application_id', 'status']);
  },
};

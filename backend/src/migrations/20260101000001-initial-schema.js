'use strict';

const ts = (Sequelize) => ({
  createdAt: { type: Sequelize.DATE, allowNull: false, field: 'created_at', defaultValue: Sequelize.NOW },
  updatedAt: { type: Sequelize.DATE, allowNull: false, field: 'updated_at', defaultValue: Sequelize.NOW },
});

const id = (Sequelize) => ({
  id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
});

const ENUM_TYPES = [
  'enum_users_status',
  'enum_applications_status', 'enum_applications_priority',
  'enum_application_tech_stack_category',
  'enum_application_features_status',
  'enum_architecture_docs_doc_type',
  'enum_api_endpoints_method',
  'enum_bug_history_severity', 'enum_bug_history_status',
  'enum_known_issues_severity', 'enum_known_issues_status',
  'enum_roadmap_items_status', 'enum_roadmap_items_priority',
  'enum_timeline_milestones_status',
  'enum_ideas_estimated_complexity', 'enum_ideas_status', 'enum_ideas_priority',
  'enum_application_suggestions_type', 'enum_application_suggestions_severity',
  'enum_application_suggestions_priority', 'enum_application_suggestions_status',
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('roles', {
      ...id(Sequelize),
      name: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      label: { type: Sequelize.STRING(100), allowNull: false },
      description: { type: Sequelize.TEXT },
      ...ts(Sequelize),
    });

    await queryInterface.createTable('departments', {
      ...id(Sequelize),
      name: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      description: { type: Sequelize.TEXT },
      ...ts(Sequelize),
    });

    await queryInterface.createTable('teams', {
      ...id(Sequelize),
      name: { type: Sequelize.STRING(120), allowNull: false },
      department_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'departments', key: 'id' }, onDelete: 'SET NULL' },
      ...ts(Sequelize),
    });
    await queryInterface.addIndex('teams', ['department_id', 'name'], { unique: true, name: 'teams_department_name_unique' });

    await queryInterface.createTable('users', {
      ...id(Sequelize),
      name: { type: Sequelize.STRING(150), allowNull: false },
      email: { type: Sequelize.STRING(150), allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING(255), allowNull: false },
      role_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'roles', key: 'id' }, onDelete: 'RESTRICT' },
      department_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'departments', key: 'id' }, onDelete: 'SET NULL' },
      team_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'teams', key: 'id' }, onDelete: 'SET NULL' },
      avatar_url: { type: Sequelize.STRING(500) },
      status: { type: Sequelize.ENUM('active', 'inactive'), allowNull: false, defaultValue: 'active' },
      last_login_at: { type: Sequelize.DATE },
      ...ts(Sequelize),
    });

    await queryInterface.createTable('role_permissions', {
      ...id(Sequelize),
      role_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'roles', key: 'id' }, onDelete: 'CASCADE' },
      resource: { type: Sequelize.STRING(60), allowNull: false },
      action: { type: Sequelize.STRING(20), allowNull: false },
      ...ts(Sequelize),
    });
    await queryInterface.addIndex('role_permissions', ['role_id', 'resource', 'action'], { unique: true, name: 'role_permissions_unique' });

    await queryInterface.createTable('notifications', {
      ...id(Sequelize),
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      type: { type: Sequelize.STRING(60), allowNull: false },
      title: { type: Sequelize.STRING(200), allowNull: false },
      message: { type: Sequelize.TEXT },
      link: { type: Sequelize.STRING(500) },
      is_read: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      ...ts(Sequelize),
    });
    await queryInterface.addIndex('notifications', ['user_id', 'is_read']);

    await queryInterface.createTable('audit_logs', {
      ...id(Sequelize),
      user_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      action: { type: Sequelize.STRING(20), allowNull: false },
      entity_type: { type: Sequelize.STRING(60), allowNull: false },
      entity_id: { type: Sequelize.UUID, allowNull: true },
      old_value: { type: Sequelize.JSONB },
      new_value: { type: Sequelize.JSONB },
      ip_address: { type: Sequelize.STRING(60) },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('audit_logs', ['entity_type', 'entity_id']);
    await queryInterface.addIndex('audit_logs', ['user_id']);

    await queryInterface.createTable('attachments', {
      ...id(Sequelize),
      entity_type: { type: Sequelize.STRING(60), allowNull: false },
      entity_id: { type: Sequelize.UUID, allowNull: false },
      file_name: { type: Sequelize.STRING(255), allowNull: false },
      file_path: { type: Sequelize.STRING(500), allowNull: false },
      file_size: { type: Sequelize.INTEGER },
      mime_type: { type: Sequelize.STRING(120) },
      uploaded_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      ...ts(Sequelize),
    });
    await queryInterface.addIndex('attachments', ['entity_type', 'entity_id']);

    await queryInterface.createTable('comments', {
      ...id(Sequelize),
      entity_type: { type: Sequelize.STRING(60), allowNull: false },
      entity_id: { type: Sequelize.UUID, allowNull: false },
      parent_comment_id: { type: Sequelize.UUID, allowNull: true },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      body: { type: Sequelize.TEXT, allowNull: false },
      ...ts(Sequelize),
    });
    await queryInterface.addConstraint('comments', {
      fields: ['parent_comment_id'], type: 'foreign key', name: 'comments_parent_comment_id_fkey',
      references: { table: 'comments', field: 'id' }, onDelete: 'CASCADE',
    });
    await queryInterface.addIndex('comments', ['entity_type', 'entity_id']);
    await queryInterface.addIndex('comments', ['parent_comment_id']);

    await queryInterface.createTable('votes', {
      ...id(Sequelize),
      entity_type: { type: Sequelize.STRING(60), allowNull: false },
      entity_id: { type: Sequelize.UUID, allowNull: false },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      vote_type: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'upvote' },
      ...ts(Sequelize),
    });
    await queryInterface.addIndex('votes', ['entity_type', 'entity_id', 'user_id', 'vote_type'], { unique: true, name: 'votes_unique' });

    await queryInterface.createTable('tags', {
      ...id(Sequelize),
      name: { type: Sequelize.STRING(60), allowNull: false, unique: true },
      ...ts(Sequelize),
    });

    await queryInterface.createTable('taggables', {
      ...id(Sequelize),
      tag_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'tags', key: 'id' }, onDelete: 'CASCADE' },
      entity_type: { type: Sequelize.STRING(60), allowNull: false },
      entity_id: { type: Sequelize.UUID, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('taggables', ['tag_id', 'entity_type', 'entity_id'], { unique: true, name: 'taggables_unique' });
    await queryInterface.addIndex('taggables', ['entity_type', 'entity_id']);

    await queryInterface.createTable('status_history', {
      ...id(Sequelize),
      entity_type: { type: Sequelize.STRING(60), allowNull: false },
      entity_id: { type: Sequelize.UUID, allowNull: false },
      from_status: { type: Sequelize.STRING(40) },
      to_status: { type: Sequelize.STRING(40), allowNull: false },
      changed_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      note: { type: Sequelize.TEXT },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('status_history', ['entity_type', 'entity_id']);

    await queryInterface.createTable('applications', {
      ...id(Sequelize),
      name: { type: Sequelize.STRING(200), allowNull: false },
      description: { type: Sequelize.TEXT },
      category: { type: Sequelize.STRING(80) },
      owner_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      team_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'teams', key: 'id' }, onDelete: 'SET NULL' },
      department_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'departments', key: 'id' }, onDelete: 'SET NULL' },
      status: { type: Sequelize.ENUM('planning', 'in_progress', 'completed', 'on_hold', 'deprecated'), allowNull: false, defaultValue: 'planning' },
      priority: { type: Sequelize.ENUM('low', 'medium', 'high', 'critical'), allowNull: false, defaultValue: 'medium' },
      start_date: { type: Sequelize.DATEONLY },
      release_date: { type: Sequelize.DATEONLY },
      current_version: { type: Sequelize.STRING(30) },
      repository_url: { type: Sequelize.STRING(500) },
      deployment_url: { type: Sequelize.STRING(500) },
      created_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      search_vector: { type: Sequelize.TSVECTOR },
      ...ts(Sequelize),
    });
    await queryInterface.addIndex('applications', ['status']);
    await queryInterface.addIndex('applications', ['category']);
    await queryInterface.addIndex('applications', ['owner_id']);
    await queryInterface.addIndex('applications', ['search_vector'], { using: 'GIN', name: 'applications_search_vector_gin' });

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

    await queryInterface.createTable('known_issues', {
      ...id(Sequelize),
      application_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'applications', key: 'id' }, onDelete: 'CASCADE' },
      title: { type: Sequelize.STRING(200), allowNull: false },
      description: { type: Sequelize.TEXT },
      severity: { type: Sequelize.ENUM('low', 'medium', 'high', 'critical'), allowNull: false, defaultValue: 'medium' },
      status: { type: Sequelize.ENUM('active', 'monitoring', 'resolved'), allowNull: false, defaultValue: 'active' },
      workaround: { type: Sequelize.TEXT },
      ...ts(Sequelize),
    });
    await queryInterface.addIndex('known_issues', ['application_id', 'status']);

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

    await queryInterface.createTable('ideas', {
      ...id(Sequelize),
      title: { type: Sequelize.STRING(200), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: false },
      business_problem: { type: Sequelize.TEXT },
      proposed_solution: { type: Sequelize.TEXT },
      expected_benefits: { type: Sequelize.TEXT },
      ai_usage: { type: Sequelize.TEXT },
      technology_suggestion: { type: Sequelize.TEXT },
      department_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'departments', key: 'id' }, onDelete: 'SET NULL' },
      target_users: { type: Sequelize.STRING(300) },
      estimated_complexity: { type: Sequelize.ENUM('low', 'medium', 'high'), defaultValue: 'medium' },
      estimated_dev_time: { type: Sequelize.STRING(60) },
      status: { type: Sequelize.ENUM('submitted', 'discussion', 'review', 'approved', 'rejected', 'development_ready'), allowNull: false, defaultValue: 'submitted' },
      priority: { type: Sequelize.ENUM('low', 'medium', 'high', 'critical'), allowNull: false, defaultValue: 'medium' },
      submitted_by: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      reviewer_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      review_notes: { type: Sequelize.TEXT },
      reviewer_feedback: { type: Sequelize.TEXT },
      search_vector: { type: Sequelize.TSVECTOR },
      ...ts(Sequelize),
    });
    await queryInterface.addIndex('ideas', ['status']);
    await queryInterface.addIndex('ideas', ['submitted_by']);
    await queryInterface.addIndex('ideas', ['search_vector'], { using: 'GIN', name: 'ideas_search_vector_gin' });

    await queryInterface.createTable('application_suggestions', {
      ...id(Sequelize),
      application_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'applications', key: 'id' }, onDelete: 'CASCADE' },
      type: { type: Sequelize.ENUM('feature_request', 'bug_report', 'ui_improvement', 'security_improvement', 'performance_improvement', 'ai_enhancement', 'database_optimization', 'api_improvement', 'cost_optimization'), allowNull: false },
      title: { type: Sequelize.STRING(200), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: false },
      current_problem: { type: Sequelize.TEXT },
      suggested_solution: { type: Sequelize.TEXT },
      expected_benefit: { type: Sequelize.TEXT },
      severity: { type: Sequelize.ENUM('low', 'medium', 'high', 'critical'), allowNull: false, defaultValue: 'medium' },
      priority: { type: Sequelize.ENUM('low', 'medium', 'high', 'critical'), allowNull: false, defaultValue: 'medium' },
      module: { type: Sequelize.STRING(120) },
      status: { type: Sequelize.ENUM('submitted', 'technical_review', 'discussion', 'approved', 'assigned', 'implemented', 'closed'), allowNull: false, defaultValue: 'submitted' },
      assigned_to: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      submitted_by: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      search_vector: { type: Sequelize.TSVECTOR },
      ...ts(Sequelize),
    });
    await queryInterface.addIndex('application_suggestions', ['application_id', 'status']);
    await queryInterface.addIndex('application_suggestions', ['submitted_by']);
    await queryInterface.addIndex('application_suggestions', ['search_vector'], { using: 'GIN', name: 'application_suggestions_search_vector_gin' });
  },

  async down(queryInterface) {
    const tablesInReverseOrder = [
      'application_suggestions', 'ideas', 'timeline_milestones', 'roadmap_items', 'known_issues',
      'bug_history', 'release_notes', 'db_table_docs', 'api_endpoints', 'architecture_docs',
      'ai_prompts', 'feature_dependencies', 'application_features', 'application_tech_stack',
      'applications', 'status_history', 'taggables', 'tags', 'votes', 'comments', 'attachments',
      'audit_logs', 'notifications', 'role_permissions', 'users', 'teams', 'departments', 'roles',
    ];
    for (const table of tablesInReverseOrder) {
      await queryInterface.dropTable(table);
    }
    for (const enumType of ENUM_TYPES) {
      await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "${enumType}";`);
    }
  },
};

'use strict';
const { v4: uuidv4 } = require('uuid');
const { DEPARTMENT_IDS, USER_IDS, APPLICATION_IDS } = require('./helpers/refs');

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    await queryInterface.bulkInsert('applications', [
      {
        id: APPLICATION_IDS.appTracker, name: 'Application Library and Management System',
        description: 'Central platform tracking every internal application, new application ideas, and improvement suggestions.',
        category: 'Internal Tooling', owner_id: USER_IDS.teamLead, department_id: DEPARTMENT_IDS.engineering,
        status: 'testing', priority: 'high', start_date: '2026-01-15', current_version: '1.0.0',
        repository_url: 'https://github.com/org/alms', deployment_url: 'https://alms.internal.company.com',
        created_by: USER_IDS.teamLead, created_at: now, updated_at: now,
      },
      {
        id: APPLICATION_IDS.supportBot, name: 'AI Support Ticket Triage Bot',
        description: 'Uses an LLM to classify, prioritize, and auto-route incoming support tickets.',
        category: 'Customer Support', owner_id: USER_IDS.devTwo, department_id: DEPARTMENT_IDS.dataAi,
        status: 'deployment', priority: 'medium', start_date: '2025-08-01', release_date: '2025-11-10', current_version: '2.3.0',
        repository_url: 'https://github.com/org/support-triage-bot', deployment_url: 'https://triage.internal.company.com',
        created_by: USER_IDS.devTwo, created_at: now, updated_at: now,
      },
      {
        id: APPLICATION_IDS.invoiceOcr, name: 'Invoice OCR Extraction Service',
        description: 'Extracts structured line-item data from scanned vendor invoices using OCR + AI post-processing.',
        category: 'Finance Automation', owner_id: USER_IDS.devOne, department_id: DEPARTMENT_IDS.engineering,
        status: 'development', priority: 'medium', start_date: '2026-06-01',
        repository_url: 'https://github.com/org/invoice-ocr',
        created_by: USER_IDS.devOne, created_at: now, updated_at: now,
      },
    ]);

    await queryInterface.sequelize.query(`
      UPDATE applications SET search_vector = to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,''));
    `);

    await queryInterface.bulkInsert('application_tech_stack', [
      { id: uuidv4(), application_id: APPLICATION_IDS.appTracker, category: 'frontend', name: 'React', version: '18', created_at: now, updated_at: now },
      { id: uuidv4(), application_id: APPLICATION_IDS.appTracker, category: 'frontend', name: 'Redux Toolkit', version: '2.x', created_at: now, updated_at: now },
      { id: uuidv4(), application_id: APPLICATION_IDS.appTracker, category: 'backend', name: 'Node.js / Express', version: '20 / 4.x', created_at: now, updated_at: now },
      { id: uuidv4(), application_id: APPLICATION_IDS.appTracker, category: 'database', name: 'PostgreSQL', version: '16', created_at: now, updated_at: now },
      { id: uuidv4(), application_id: APPLICATION_IDS.supportBot, category: 'ai_model', name: 'Claude (Anthropic API)', version: 'claude-sonnet', created_at: now, updated_at: now },
      { id: uuidv4(), application_id: APPLICATION_IDS.supportBot, category: 'backend', name: 'Node.js / Express', version: '18', created_at: now, updated_at: now },
      { id: uuidv4(), application_id: APPLICATION_IDS.invoiceOcr, category: 'ai_model', name: 'Tesseract OCR + LLM post-processing', created_at: now, updated_at: now },
    ]);

    await queryInterface.bulkInsert('application_features', [
      { id: uuidv4(), application_id: APPLICATION_IDS.appTracker, name: 'Application Tracking & Documentation module', status: 'in_progress', assigned_developer_id: USER_IDS.devOne, estimated_time: '3 weeks', created_at: now, updated_at: now },
      { id: uuidv4(), application_id: APPLICATION_IDS.appTracker, name: 'New Application Ideas module', status: 'in_progress', assigned_developer_id: USER_IDS.devTwo, estimated_time: '2 weeks', created_at: now, updated_at: now },
      { id: uuidv4(), application_id: APPLICATION_IDS.appTracker, name: 'Existing Application Review & Improvement module', status: 'planned', estimated_time: '2 weeks', created_at: now, updated_at: now },
      { id: uuidv4(), application_id: APPLICATION_IDS.supportBot, name: 'Auto-classification of incoming tickets', status: 'completed', assigned_developer_id: USER_IDS.devTwo, completion_date: '2025-10-20', created_at: now, updated_at: now },
    ]);

    await queryInterface.bulkInsert('ai_prompts', [
      {
        id: uuidv4(), application_id: APPLICATION_IDS.appTracker, title: 'Generate Sequelize model + migration for a new entity',
        prompt_text: 'Given this table description, generate a Sequelize model file and a matching migration following our project conventions (UUID pk, underscored columns, associate() function).',
        prompt_type: 'code_generation', ai_model: 'Claude Sonnet', output_summary: 'Produced consistent model/migration pairs for all 28 tables.',
        version: 'v1', created_by: USER_IDS.teamLead, created_at: now, updated_at: now,
      },
      {
        id: uuidv4(), application_id: APPLICATION_IDS.supportBot, title: 'Ticket classification prompt',
        prompt_text: 'Classify the following support ticket into one of: billing, technical, account, feature_request. Respond with JSON only.',
        prompt_type: 'classification', ai_model: 'Claude Sonnet', output_summary: 'Achieved 92% routing accuracy in staging evaluation.',
        version: 'v3', created_by: USER_IDS.devTwo, created_at: now, updated_at: now,
      },
    ]);
    await queryInterface.sequelize.query(`
      UPDATE ai_prompts SET search_vector = to_tsvector('english', coalesce(title,'') || ' ' || coalesce(prompt_text,''));
    `);

    await queryInterface.bulkInsert('architecture_docs', [
      { id: uuidv4(), application_id: APPLICATION_IDS.appTracker, doc_type: 'high_level', title: 'High Level Architecture', content_markdown: 'React SPA -> REST API (Express, MVC + clean architecture) -> PostgreSQL. JWT auth, role-based permissions loaded from the database.', updated_by: USER_IDS.teamLead, created_at: now, updated_at: now },
      { id: uuidv4(), application_id: APPLICATION_IDS.appTracker, doc_type: 'auth_flow', title: 'Authentication Flow', content_markdown: 'Login -> issue JWT (role + permissions embedded via lookup) -> frontend stores token -> axios interceptor attaches Authorization header -> backend auth middleware verifies + rbac middleware checks resource/action.', updated_by: USER_IDS.teamLead, created_at: now, updated_at: now },
    ]);

    await queryInterface.bulkInsert('release_notes', [
      { id: uuidv4(), application_id: APPLICATION_IDS.appTracker, version: '1.0.0', release_date: '2026-07-28', new_features: ['Initial release of all three modules'], bug_fixes: null, breaking_changes: null, created_by: USER_IDS.teamLead, created_at: now, updated_at: now },
      { id: uuidv4(), application_id: APPLICATION_IDS.supportBot, version: '2.3.0', release_date: '2025-11-10', new_features: ['Multi-language ticket support'], bug_fixes: ['Fixed misclassification of billing refund requests'], breaking_changes: null, created_by: USER_IDS.devTwo, created_at: now, updated_at: now },
    ]);

    await queryInterface.bulkInsert('bug_history', [
      { id: uuidv4(), application_id: APPLICATION_IDS.supportBot, title: 'Refund requests misrouted to technical queue', description: 'Prompt did not distinguish refund language from generic billing issues.', severity: 'medium', status: 'resolved', reported_by: USER_IDS.employeeOne, resolved_by: USER_IDS.devTwo, reported_date: '2025-10-01', resolved_date: '2025-10-20', created_at: now, updated_at: now },
    ]);

    await queryInterface.bulkInsert('known_issues', [
      { id: uuidv4(), application_id: APPLICATION_IDS.supportBot, title: 'Occasional timeout on very long ticket bodies', description: 'Tickets over ~8k tokens can exceed the classification timeout.', severity: 'low', status: 'monitoring', workaround: 'Truncate ticket body to first 4000 tokens before classification.', created_at: now, updated_at: now },
    ]);

    await queryInterface.bulkInsert('roadmap_items', [
      { id: uuidv4(), application_id: APPLICATION_IDS.appTracker, title: 'Websocket-based live notifications', description: 'Replace polling with push notifications.', target_quarter: '2026-Q4', status: 'proposed', priority: 'medium', created_at: now, updated_at: now },
      { id: uuidv4(), application_id: APPLICATION_IDS.appTracker, title: 'Automatic DB schema introspection for DB docs', description: 'Auto-generate the DB documentation tab from live schema instead of manual entry.', target_quarter: '2027-Q1', status: 'proposed', priority: 'low', created_at: now, updated_at: now },
    ]);

    await queryInterface.bulkInsert('timeline_milestones', [
      { id: uuidv4(), application_id: APPLICATION_IDS.appTracker, title: 'Foundation & auth complete', due_date: '2026-07-10', status: 'completed', created_at: now, updated_at: now },
      { id: uuidv4(), application_id: APPLICATION_IDS.appTracker, title: 'All three modules integrated', due_date: '2026-07-28', status: 'in_progress', created_at: now, updated_at: now },
      { id: uuidv4(), application_id: APPLICATION_IDS.appTracker, title: 'Company-wide rollout', due_date: '2026-08-15', status: 'upcoming', created_at: now, updated_at: now },
    ]);
  },

  async down(queryInterface) {
    const tables = [
      'timeline_milestones', 'roadmap_items', 'known_issues', 'bug_history', 'release_notes',
      'architecture_docs', 'ai_prompts', 'application_features', 'application_tech_stack', 'applications',
    ];
    for (const t of tables) await queryInterface.bulkDelete(t, null, {});
  },
};

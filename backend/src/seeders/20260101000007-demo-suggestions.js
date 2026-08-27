'use strict';
const { v4: uuidv4 } = require('uuid');
const { USER_IDS, APPLICATION_IDS, DEPARTMENT_IDS } = require('./helpers/refs');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const suggestionOne = uuidv4();
    const suggestionTwo = uuidv4();

    await queryInterface.bulkInsert('application_suggestions', [
      {
        id: suggestionOne, application_id: APPLICATION_IDS.supportBot, department_id: DEPARTMENT_IDS.dataAi,
        title: 'Cache classification results for duplicate ticket bodies',
        description: 'Some customers submit near-identical tickets; caching would cut model calls significantly.',
        current_problem: 'Every ticket triggers a fresh LLM call even when the body is a near-duplicate of a recently seen ticket.',
        suggested_solution: 'Hash normalized ticket body, cache classification for 24h, and reuse cached results within that window.',
        expected_benefit: 'Estimated 15-20% reduction in API cost.', priority: 'medium', module: 'Classification pipeline',
        status: 'technical_review', submitted_by: USER_IDS.devOne, created_at: now, updated_at: now,
      },
      {
        id: suggestionTwo, application_id: APPLICATION_IDS.appTracker, department_id: DEPARTMENT_IDS.engineering,
        title: 'Add Kanban board view for suggestions', description: 'A drag-and-drop board across the workflow statuses would make triage faster than a flat list.',
        current_problem: 'Reviewers currently filter the list view manually per status.', suggested_solution: 'Add a Kanban board page with columns per status, using the existing status_history for audit trail.',
        expected_benefit: 'Faster triage, clearer at-a-glance workload view.', priority: 'medium', module: 'Suggestions module',
        status: 'submitted', submitted_by: USER_IDS.employeeTwo, created_at: now, updated_at: now,
      },
    ]);

    await queryInterface.sequelize.query(`
      UPDATE application_suggestions SET search_vector = to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''));
    `);

    await queryInterface.bulkInsert('comments', [
      { id: uuidv4(), entity_type: 'suggestion', entity_id: suggestionOne, user_id: USER_IDS.teamLead, body: 'Agreed — let\'s bound the cache to non-PII ticket bodies only.', created_at: now, updated_at: now },
    ]);

    await queryInterface.bulkInsert('votes', [
      { id: uuidv4(), entity_type: 'suggestion', entity_id: suggestionOne, user_id: USER_IDS.devTwo, vote_type: 'upvote', created_at: now, updated_at: now },
    ]);

    await queryInterface.bulkInsert('status_history', [
      { id: uuidv4(), entity_type: 'suggestion', entity_id: suggestionOne, from_status: 'submitted', to_status: 'technical_review', changed_by: USER_IDS.teamLead, created_at: now },
    ]);

    await queryInterface.bulkInsert('notifications', [
      { id: uuidv4(), user_id: USER_IDS.devOne, type: 'suggestion_status_change', title: 'Your suggestion moved to Technical Review', message: '"Cache classification results for duplicate ticket bodies" is now in technical review.', link: `/suggestions/${suggestionOne}`, is_read: false, created_at: now, updated_at: now },
      { id: uuidv4(), user_id: USER_IDS.teamLead, type: 'idea_submitted', title: 'New idea submitted', message: 'Ethan Employee submitted a new idea: "Expense report anomaly detector".', link: '/ideas', is_read: false, created_at: now, updated_at: now },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('notifications', null, {});
    await queryInterface.bulkDelete('status_history', { entity_type: 'suggestion' }, {});
    await queryInterface.bulkDelete('votes', { entity_type: 'suggestion' }, {});
    await queryInterface.bulkDelete('comments', { entity_type: 'suggestion' }, {});
    await queryInterface.bulkDelete('application_suggestions', null, {});
  },
};

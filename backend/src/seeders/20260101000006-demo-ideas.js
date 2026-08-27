'use strict';
const { v4: uuidv4 } = require('uuid');
const { DEPARTMENT_IDS, USER_IDS, IDEA_IDS } = require('./helpers/refs');

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert('ideas', [
      {
        id: IDEA_IDS.ideaOne, title: 'AI-assisted meeting notes summarizer',
        description: 'Automatically summarize internal meeting recordings into action items and decisions.',
        business_problem: 'Employees spend hours writing meeting notes manually and details get lost.',
        proposed_solution: 'Transcribe recordings and use an LLM to produce a structured summary + action items.',
        expected_benefits: 'Saves ~3 hours/week per manager; improves follow-through on action items.',
        ai_usage: 'LLM summarization on top of speech-to-text transcript.',
        technology_suggestion: 'Whisper for transcription, Claude for summarization.',
        department_id: DEPARTMENT_IDS.productDesign, target_users: 'Managers and team leads', estimated_complexity: 'medium',
        estimated_dev_time: '4 weeks', status: 'review', priority: 'high', submitted_by: USER_IDS.employeeTwo,
        reviewer_id: USER_IDS.reviewer, created_at: now, updated_at: now,
      },
      {
        id: IDEA_IDS.ideaTwo, title: 'Internal AI code review assistant',
        description: 'A bot that leaves automated review comments on pull requests using the AI Prompt Library patterns.',
        business_problem: 'Senior engineers spend too much time on repetitive review feedback.',
        proposed_solution: 'GitHub Action that runs an LLM review pass and posts inline comments.',
        expected_benefits: 'Faster PR turnaround, more consistent review standards.',
        ai_usage: 'LLM-based static analysis and review comment generation.',
        technology_suggestion: 'GitHub Actions + Claude API.',
        department_id: DEPARTMENT_IDS.engineering, target_users: 'Engineering teams', estimated_complexity: 'high',
        estimated_dev_time: '6 weeks', status: 'discussion', priority: 'medium', submitted_by: USER_IDS.devOne,
        created_at: now, updated_at: now,
      },
      {
        id: IDEA_IDS.ideaThree, title: 'Expense report anomaly detector',
        description: 'Flag unusual expense report line items for finance review before reimbursement.',
        business_problem: 'Manual expense audits are slow and inconsistent.',
        proposed_solution: 'ML model scores each line item; anything above a threshold routes to manual review.',
        expected_benefits: 'Reduces audit time by 50%, catches policy violations earlier.',
        ai_usage: 'Anomaly detection model.', technology_suggestion: 'scikit-learn baseline, revisit with LLM reasoning later.',
        department_id: DEPARTMENT_IDS.operations, target_users: 'Finance & Operations', estimated_complexity: 'medium',
        estimated_dev_time: '5 weeks', status: 'submitted', priority: 'low', submitted_by: USER_IDS.employeeOne,
        created_at: now, updated_at: now,
      },
    ]);

    await queryInterface.sequelize.query(`
      UPDATE ideas SET search_vector = to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''));
    `);

    await queryInterface.bulkInsert('comments', [
      { id: uuidv4(), entity_type: 'idea', entity_id: IDEA_IDS.ideaOne, user_id: USER_IDS.reviewer, body: 'Strong pitch — can we scope a v1 to just engineering standups first?', created_at: now, updated_at: now },
      { id: uuidv4(), entity_type: 'idea', entity_id: IDEA_IDS.ideaTwo, user_id: USER_IDS.teamLead, body: 'How would this integrate with our existing CI checks?', created_at: now, updated_at: now },
    ]);

    await queryInterface.bulkInsert('votes', [
      { id: uuidv4(), entity_type: 'idea', entity_id: IDEA_IDS.ideaOne, user_id: USER_IDS.devOne, vote_type: 'upvote', created_at: now, updated_at: now },
      { id: uuidv4(), entity_type: 'idea', entity_id: IDEA_IDS.ideaOne, user_id: USER_IDS.devTwo, vote_type: 'upvote', created_at: now, updated_at: now },
      { id: uuidv4(), entity_type: 'idea', entity_id: IDEA_IDS.ideaTwo, user_id: USER_IDS.employeeOne, vote_type: 'upvote', created_at: now, updated_at: now },
    ]);

    await queryInterface.bulkInsert('status_history', [
      { id: uuidv4(), entity_type: 'idea', entity_id: IDEA_IDS.ideaOne, from_status: 'submitted', to_status: 'discussion', changed_by: USER_IDS.reviewer, created_at: now },
      { id: uuidv4(), entity_type: 'idea', entity_id: IDEA_IDS.ideaOne, from_status: 'discussion', to_status: 'review', changed_by: USER_IDS.reviewer, created_at: now },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('status_history', { entity_type: 'idea' }, {});
    await queryInterface.bulkDelete('votes', { entity_type: 'idea' }, {});
    await queryInterface.bulkDelete('comments', { entity_type: 'idea' }, {});
    await queryInterface.bulkDelete('ideas', null, {});
  },
};

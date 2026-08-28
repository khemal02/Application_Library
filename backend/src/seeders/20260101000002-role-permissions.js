'use strict';
const { v4: uuidv4 } = require('uuid');
const { ROLE_IDS } = require('./helpers/refs');

const DOC_SUBRESOURCES = [
  'tech_stack', 'features', 'ai_prompts', 'architecture_docs', 'api_docs',
  'db_docs', 'releases', 'bugs', 'known_issues', 'roadmap', 'timeline',
];

function expand(roleId, resources, actions) {
  const rows = [];
  resources.forEach((resource) => {
    actions.forEach((action) => {
      rows.push({ id: uuidv4(), role_id: roleId, resource, action });
    });
  });
  return rows;
}

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    let rows = [];

    // Admin: system administrator — unrestricted, manages users/roles/permissions/departments.
    rows = rows.concat(expand(ROLE_IDS.admin, ['*'], ['manage']));

    // CEO: full access to business data/workflows, plus Users and Departments
    // (Administration). Roles & Permissions stays Admin-only — editing the permission matrix
    // can grant privileges, including to oneself, so that stays a dedicated system-admin action.
    rows = rows.concat(expand(
      ROLE_IDS.ceo,
      ['applications', ...DOC_SUBRESOURCES, 'ideas', 'suggestions', 'comments', 'votes', 'attachments', 'users', 'departments'],
      ['manage'],
    ));
    rows = rows.concat(expand(ROLE_IDS.ceo, ['dashboard', 'search', 'notifications', 'audit_logs'], ['read']));
    rows = rows.concat(expand(ROLE_IDS.ceo, ['change_requests'], ['manage']));

    // Manager: near-full — full control over applications/docs, reviews & approves
    // ideas/suggestions org-wide. The Administration area (Users, Roles & Permissions,
    // Departments) is Admin-only.
    rows = rows.concat(expand(
      ROLE_IDS.manager,
      ['applications', ...DOC_SUBRESOURCES, 'ideas', 'suggestions', 'comments', 'votes', 'attachments'],
      ['manage'],
    ));
    rows = rows.concat(expand(ROLE_IDS.manager, ['dashboard', 'search', 'notifications', 'audit_logs'], ['read']));
    rows = rows.concat(expand(ROLE_IDS.manager, ['change_requests'], ['manage']));

    // Team Lead: full ownership over applications + docs, reviews ideas/suggestions for their team.
    rows = rows.concat(expand(ROLE_IDS.team_lead, ['applications'], ['create', 'read', 'update']));
    rows = rows.concat(expand(ROLE_IDS.team_lead, DOC_SUBRESOURCES, ['create', 'read', 'update', 'delete']));
    rows = rows.concat(expand(ROLE_IDS.team_lead, ['ideas'], ['create', 'read', 'review', 'update']));
    rows = rows.concat(expand(ROLE_IDS.team_lead, ['suggestions'], ['create', 'read', 'review', 'update', 'assign']));
    rows = rows.concat(expand(ROLE_IDS.team_lead, ['comments', 'votes', 'attachments'], ['create', 'read']));
    rows = rows.concat(expand(ROLE_IDS.team_lead, ['dashboard', 'search', 'notifications', 'audit_logs'], ['read']));
    rows = rows.concat(expand(ROLE_IDS.team_lead, ['change_requests'], ['create', 'read', 'update', 'delete']));

    // Employee: browses the application catalog and comments on it (read-only on applications and
    // every doc sub-resource — no add/edit there), submits ideas/suggestions and edits their own
    // submissions. No 'review' — moving an idea/suggestion through its workflow (Discussion ->
    // Review -> Approved -> Development Ready, etc.) is Team Lead+ only.
    rows = rows.concat(expand(ROLE_IDS.employee, ['applications'], ['read']));
    rows = rows.concat(expand(ROLE_IDS.employee, DOC_SUBRESOURCES, ['read']));
    rows = rows.concat(expand(ROLE_IDS.employee, ['ideas', 'suggestions'], ['create', 'read', 'update']));
    rows = rows.concat(expand(ROLE_IDS.employee, ['comments', 'votes', 'attachments'], ['create', 'read']));
    rows = rows.concat(expand(ROLE_IDS.employee, ['dashboard', 'search', 'notifications'], ['read']));
    // Everyone gets full CRUD on Change Requests, same shape as Team Lead — unlike every other
    // doc sub-resource, this one isn't gated by role.
    rows = rows.concat(expand(ROLE_IDS.employee, ['change_requests'], ['create', 'read', 'update', 'delete']));

    await queryInterface.bulkInsert(
      'role_permissions',
      rows.map((r) => ({ ...r, created_at: now, updated_at: now })),
    );
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('role_permissions', null, {});
  },
};

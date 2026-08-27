'use strict';
const { ROLE_IDS } = require('./helpers/refs');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert('roles', [
      { id: ROLE_IDS.admin, name: 'admin', label: 'Admin', description: 'System administrator — full unrestricted access, manages users, roles/permissions, departments, and teams.', created_at: now, updated_at: now },
      { id: ROLE_IDS.ceo, name: 'ceo', label: 'CEO', description: 'Full access to all business data and workflows (applications, ideas, suggestions, documentation, reports). User and role administration is handled by Admin.', created_at: now, updated_at: now },
      { id: ROLE_IDS.manager, name: 'manager', label: 'Manager', description: 'Manages users, departments, teams, applications, and reviews ideas/suggestions org-wide.', created_at: now, updated_at: now },
      { id: ROLE_IDS.team_lead, name: 'team_lead', label: 'Team Lead', description: 'Manages applications and reviews ideas/suggestions for their team.', created_at: now, updated_at: now },
      { id: ROLE_IDS.employee, name: 'employee', label: 'Employee', description: 'Builds and documents applications, submits and reviews ideas/suggestions, browses the application catalog.', created_at: now, updated_at: now },
    ]);
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('roles', null, {});
  },
};

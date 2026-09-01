'use strict';

const { v4: uuidv4 } = require('uuid');

// Mirrors the live 'change_requests' grants (checked before writing this — see the project
// report) onto the new 'issues' resource: create/read/update for team_lead and employee, manage
// for ceo/manager. No 'delete' grant — issues has no DELETE /:id route (see Stage 1b). 'admin'
// already holds the '*':'manage' wildcard and needs no explicit row.
const GRANTS = [
  { role: 'ceo', actions: ['manage'] },
  { role: 'manager', actions: ['manage'] },
  { role: 'team_lead', actions: ['create', 'read', 'update'] },
  { role: 'employee', actions: ['create', 'read', 'update'] },
];

module.exports = {
  async up(queryInterface) {
    const roles = await queryInterface.sequelize.query('SELECT id, name FROM roles', { type: queryInterface.sequelize.QueryTypes.SELECT });
    const roleIdByName = new Map(roles.map((r) => [r.name, r.id]));
    const now = new Date();
    const rows = [];
    GRANTS.forEach(({ role, actions }) => {
      const roleId = roleIdByName.get(role);
      if (!roleId) return;
      actions.forEach((action) => {
        rows.push({
          id: uuidv4(), role_id: roleId, resource: 'issues', action, created_at: now, updated_at: now,
        });
      });
    });
    if (rows.length) await queryInterface.bulkInsert('role_permissions', rows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('role_permissions', { resource: 'issues' });
  },
};

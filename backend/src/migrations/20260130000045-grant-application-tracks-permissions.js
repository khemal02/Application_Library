'use strict';

const { v4: uuidv4 } = require('uuid');

// Mirrors 20260130000040-grant-issues-permissions.js's shape (the most recent new-resource grant,
// per the discovery report's D9) onto 'application_tracks'. No 'create' grant anywhere — 1c is
// explicit that there is no POST /application-tracking; a track is only ever created by an idea
// being approved (Stage 2a). No 'delete' grant either — a track is never deleted, only cancelled.
// 'read' is deliberately broad (every role) — 1d: "read, list, add a note: any authenticated user".
// 'update' is also broad at the route/RBAC level (team_lead/employee get it same as
// change_requests) — the REAL narrower gate (track owner or super-admin only, for priority/
// assignment/hold/resume/cancel; assignee-or-owner-or-super-admin for stage work) is enforced in
// applicationTracking.service.js, same "route-level check is coarse, the service is the real gate"
// shape as change_requests/ideas. 'admin' already holds the ('*','manage') wildcard and needs no
// explicit row.
const GRANTS = [
  { role: 'ceo', actions: ['manage'] },
  { role: 'manager', actions: ['manage'] },
  { role: 'team_lead', actions: ['read', 'update'] },
  { role: 'employee', actions: ['read', 'update'] },
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
          id: uuidv4(), role_id: roleId, resource: 'application_tracks', action, created_at: now, updated_at: now,
        });
      });
    });
    if (rows.length) await queryInterface.bulkInsert('role_permissions', rows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('role_permissions', { resource: 'application_tracks' });
  },
};

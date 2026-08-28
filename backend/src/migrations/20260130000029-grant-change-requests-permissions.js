'use strict';
const { v4: uuidv4 } = require('uuid');

// Backfills change_requests permissions for the DOC_SUBRESOURCES roles now that
// 20260101000002-role-permissions.js includes it — this database was seeded before that edit, so
// the rows never landed. On a fresh install this is a harmless no-op (the seeder already grants
// it directly), same reasoning as 20260129000005-grant-team-lead-audit-logs-read.js.
const RESOURCE = 'change_requests';
const GRANTS = [
  { role: 'ceo', actions: ['manage'] },
  { role: 'manager', actions: ['manage'] },
  { role: 'team_lead', actions: ['create', 'read', 'update', 'delete'] },
  { role: 'employee', actions: ['read'] },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [roles] = await queryInterface.sequelize.query(
      'SELECT id, name FROM roles WHERE name IN (:names)',
      { replacements: { names: GRANTS.map((g) => g.role) } },
    );
    if (!roles.length) return;
    const roleIdByName = Object.fromEntries(roles.map((r) => [r.name, r.id]));

    const [existing] = await queryInterface.sequelize.query(
      'SELECT role_id, action FROM role_permissions WHERE resource = :resource',
      { replacements: { resource: RESOURCE } },
    );
    const already = new Set(existing.map((r) => `${r.role_id}:${r.action}`));

    const rows = [];
    GRANTS.forEach(({ role, actions }) => {
      const roleId = roleIdByName[role];
      if (!roleId) return;
      actions.forEach((action) => {
        if (already.has(`${roleId}:${action}`)) return;
        rows.push({ id: uuidv4(), role_id: roleId, resource: RESOURCE, action, created_at: now, updated_at: now });
      });
    });
    if (rows.length) await queryInterface.bulkInsert('role_permissions', rows);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'DELETE FROM role_permissions WHERE resource = :resource',
      { replacements: { resource: RESOURCE } },
    );
  },
};

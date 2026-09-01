'use strict';

const { v4: uuidv4 } = require('uuid');

// Mirrors the exact live 'ideas' grants (checked against the running database before writing
// this) onto a new 'feature_requests' resource, byte-for-byte — Modify Current Application is
// becoming its own module/table, so it needs its own RBAC resource instead of piggybacking on
// 'ideas'. Without this, nobody could reach the new module at all.
const GRANTS = [
  { role: 'ceo', actions: ['manage'] },
  { role: 'manager', actions: ['manage'] },
  { role: 'team_lead', actions: ['create', 'read', 'review', 'update'] },
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
          id: uuidv4(), role_id: roleId, resource: 'feature_requests', action, created_at: now, updated_at: now,
        });
      });
    });
    if (rows.length) await queryInterface.bulkInsert('role_permissions', rows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('role_permissions', { resource: 'feature_requests' });
  },
};

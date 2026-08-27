'use strict';
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// Follow-up to 20260129000002: the company's role list is actually Admin / CEO / Manager /
// Team Lead / Employee (Admin was missing from that pass). Admin becomes the dedicated system
// administrator (unrestricted — manages users, roles/permissions, departments, teams). CEO is
// narrowed from unrestricted down to full access over business data/workflows only (no user or
// role administration).
//
// On a fresh install this runs before the roles/role_permissions/users seeders populate any
// rows, so every lookup below finds nothing and the migration is a harmless no-op — the seeders
// already create the 5-role model directly in that case.
const DOC_SUBRESOURCES = [
  'tech_stack', 'features', 'ai_prompts', 'architecture_docs', 'api_docs',
  'db_docs', 'releases', 'bugs', 'known_issues', 'roadmap', 'timeline',
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [roles] = await queryInterface.sequelize.query('SELECT id, name FROM roles');
    if (!roles.length) return;
    const byName = Object.fromEntries(roles.map((r) => [r.name, r.id]));
    if (byName.admin) return; // already applied

    const adminRoleId = uuidv4();
    await queryInterface.bulkInsert('roles', [{
      id: adminRoleId, name: 'admin', label: 'Admin',
      description: 'System administrator — full unrestricted access, manages users, roles/permissions, departments, and teams.',
      created_at: now, updated_at: now,
    }]);
    await queryInterface.bulkInsert('role_permissions', [{
      id: uuidv4(), role_id: adminRoleId, resource: '*', action: 'manage', created_at: now, updated_at: now,
    }]);

    if (byName.ceo) {
      await queryInterface.sequelize.query(
        `UPDATE roles SET
           description = 'Full access to all business data and workflows (applications, ideas, suggestions, documentation, reports). User and role administration is handled by Admin.',
           updated_at = :now
         WHERE id = :id`,
        { replacements: { id: byName.ceo, now } },
      );
      await queryInterface.sequelize.query(
        'DELETE FROM role_permissions WHERE role_id = :id',
        { replacements: { id: byName.ceo } },
      );
      const ceoRows = [
        ...['applications', ...DOC_SUBRESOURCES, 'ideas', 'suggestions', 'comments', 'votes', 'attachments']
          .map((resource) => ({ resource, action: 'manage' })),
        ...['reports', 'dashboard', 'search', 'notifications', 'audit_logs'].map((resource) => ({ resource, action: 'read' })),
      ].map((r) => ({ id: uuidv4(), role_id: byName.ceo, resource: r.resource, action: r.action, created_at: now, updated_at: now }));
      await queryInterface.bulkInsert('role_permissions', ceoRows);
    }

    const [existingAdminUser] = await queryInterface.sequelize.query(
      "SELECT id FROM users WHERE email = 'admin@aams.local'",
    );
    if (!existingAdminUser.length) {
      const [[dept]] = await queryInterface.sequelize.query(
        "SELECT id FROM departments WHERE name ILIKE '%engineering%' LIMIT 1",
      );
      const [[team]] = await queryInterface.sequelize.query(
        "SELECT id FROM teams LIMIT 1",
      );
      await queryInterface.bulkInsert('users', [{
        id: uuidv4(),
        name: 'Alex Admin',
        email: 'admin@aams.local',
        password_hash: bcrypt.hashSync('Passw0rd!', 10),
        role_id: adminRoleId,
        department_id: dept?.id || null,
        team_id: team?.id || null,
        status: 'active',
        created_at: now,
        updated_at: now,
      }]);
    }
  },

  async down() {},
};

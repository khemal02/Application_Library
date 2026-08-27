'use strict';
const { v4: uuidv4 } = require('uuid');

// The company's real role structure is CEO / Manager / Team Lead / Employee — this collapses
// the original 6-role model (Super Admin, Admin, Team Lead, Developer, Reviewer, Employee) down
// to those 4:
//   super_admin -> ceo        (unchanged permissions: unrestricted)
//   admin       -> manager    (permissions replaced: near-full, not literally unrestricted)
//   team_lead   -> unchanged
//   developer + reviewer -> merged into employee (their users repointed, permissions unioned)
//
// On a fresh install this runs before the roles/role_permissions/users seeders populate any
// rows, so every lookup below finds nothing and the migration is a harmless no-op — the seeders
// already create the 4-role model directly in that case.
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

    if (byName.super_admin) {
      await queryInterface.sequelize.query(
        `UPDATE roles SET name = 'ceo', label = 'CEO',
           description = 'Full unrestricted access to every module.', updated_at = :now
         WHERE id = :id`,
        { replacements: { id: byName.super_admin, now } },
      );
    }

    if (byName.admin) {
      await queryInterface.sequelize.query(
        `UPDATE roles SET name = 'manager', label = 'Manager',
           description = 'Manages users, departments, teams, applications, and reviews ideas/suggestions org-wide.',
           updated_at = :now
         WHERE id = :id`,
        { replacements: { id: byName.admin, now } },
      );
      await queryInterface.sequelize.query(
        'DELETE FROM role_permissions WHERE role_id = :id',
        { replacements: { id: byName.admin } },
      );
      const managerRows = [
        ...['users', 'departments', 'teams', 'applications', ...DOC_SUBRESOURCES, 'ideas', 'suggestions', 'comments', 'votes', 'attachments']
          .map((resource) => ({ resource, action: 'manage' })),
        ...['reports', 'dashboard', 'search', 'notifications', 'audit_logs'].map((resource) => ({ resource, action: 'read' })),
      ].map((r) => ({ id: uuidv4(), role_id: byName.admin, resource: r.resource, action: r.action, created_at: now, updated_at: now }));
      await queryInterface.bulkInsert('role_permissions', managerRows);
    }

    if (byName.employee) {
      const mergeIds = [byName.developer, byName.reviewer].filter(Boolean);
      if (mergeIds.length) {
        await queryInterface.sequelize.query(
          'UPDATE users SET role_id = :employeeId, updated_at = :now WHERE role_id IN (:mergeIds)',
          { replacements: { employeeId: byName.employee, mergeIds, now } },
        );
        // role_permissions for developer/reviewer cascade-delete with the role rows below.
        await queryInterface.sequelize.query(
          'DELETE FROM roles WHERE id IN (:mergeIds)',
          { replacements: { mergeIds } },
        );
      }

      await queryInterface.sequelize.query(
        'DELETE FROM role_permissions WHERE role_id = :id',
        { replacements: { id: byName.employee } },
      );
      const employeeRows = [];
      const push = (resources, actions) => resources.forEach((resource) => actions.forEach((action) => employeeRows.push({
        id: uuidv4(), role_id: byName.employee, resource, action, created_at: now, updated_at: now,
      })));
      push(['applications'], ['read']);
      push(DOC_SUBRESOURCES, ['create', 'read', 'update']);
      push(['ideas', 'suggestions'], ['create', 'read', 'update', 'review']);
      push(['comments', 'votes', 'attachments'], ['create', 'read']);
      push(['reports', 'dashboard', 'search', 'notifications'], ['read']);
      await queryInterface.bulkInsert('role_permissions', employeeRows);
    }

    const renames = [
      { oldEmail: 'superadmin@aams.local', newEmail: 'ceo@aams.local', name: 'Sara Ceo' },
      { oldEmail: 'admin@aams.local', newEmail: 'manager@aams.local', name: 'Adam Manager' },
      { oldEmail: 'dev1@aams.local', newEmail: 'employee3@aams.local', name: 'Dev Kapoor' },
      { oldEmail: 'dev2@aams.local', newEmail: 'employee4@aams.local', name: 'Priya Devi' },
      { oldEmail: 'reviewer@aams.local', newEmail: 'employee5@aams.local', name: 'Rita Employee' },
    ];
    for (const r of renames) {
      await queryInterface.sequelize.query(
        'UPDATE users SET email = :newEmail, name = :name, updated_at = :now WHERE email = :oldEmail',
        { replacements: { ...r, now } },
      );
    }
  },

  // Role consolidation is lossy (developer/reviewer role rows are deleted, their users
  // repointed) — not meaningfully reversible, so down() is intentionally a no-op.
  async down() {},
};

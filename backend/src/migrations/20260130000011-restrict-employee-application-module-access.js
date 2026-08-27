'use strict';

// Employees could create/edit application sub-resources (tech stack, features, AI prompts,
// architecture/API/DB docs, releases, bugs, known issues, roadmap, timeline) — narrowing that to
// read-only. The only write action Employee keeps in the Application module is commenting
// (the generic 'comments' resource grant, unaffected by this migration). Applications themselves
// were already read-only for Employee.
const DOC_SUBRESOURCES = [
  'tech_stack', 'features', 'ai_prompts', 'architecture_docs', 'api_docs',
  'db_docs', 'releases', 'bugs', 'known_issues', 'roadmap', 'timeline',
];

module.exports = {
  async up(queryInterface) {
    const [roles] = await queryInterface.sequelize.query("SELECT id FROM roles WHERE name = 'employee'");
    if (!roles.length) return;
    const employeeId = roles[0].id;

    await queryInterface.sequelize.query(
      `DELETE FROM role_permissions
       WHERE role_id = :id
         AND resource IN ('applications', ${DOC_SUBRESOURCES.map((r) => `'${r}'`).join(', ')})
         AND action IN ('create', 'update')`,
      { replacements: { id: employeeId } },
    );
  },

  async down(queryInterface) {
    const { v4: uuidv4 } = require('uuid');
    const [roles] = await queryInterface.sequelize.query("SELECT id FROM roles WHERE name = 'employee'");
    if (!roles.length) return;
    const employeeId = roles[0].id;
    const now = new Date();

    const rows = [];
    DOC_SUBRESOURCES.forEach((resource) => {
      ['create', 'update'].forEach((action) => {
        rows.push({ id: uuidv4(), role_id: employeeId, resource, action, created_at: now, updated_at: now });
      });
    });
    await queryInterface.bulkInsert('role_permissions', rows);
  },
};

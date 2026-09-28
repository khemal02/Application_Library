'use strict';

// The previous migration (…055) didn't know 'Java' and 'SAP ABAP' were pre-existing rows — added
// straight to the live table before any seeder tracked them, purely so
// 20260101000008-demo-users-more-departments.js's name-based lookup would find them (see that
// file's own comment) — so it inserted fresh, empty 'Java App Programmer'/'S4H ABAP' rows
// alongside them, leaving two duplicate concepts. This merges each pair: whatever already pointed
// at the old row gets relinked to the real final row, then the old (now-empty) row is deleted.
const MERGES = [
  { oldName: 'Java', newName: 'Java App Programmer' },
  { oldName: 'SAP ABAP', newName: 'S4H ABAP' },
];
const REFERENCING_TABLES = ['users', 'applications', 'ideas', 'feature_requests'];

module.exports = {
  async up(queryInterface) {
    for (const { oldName, newName } of MERGES) {
      const [[oldRow]] = await queryInterface.sequelize.query(
        'SELECT id FROM departments WHERE name = :oldName', { replacements: { oldName } },
      );
      const [[newRow]] = await queryInterface.sequelize.query(
        'SELECT id FROM departments WHERE name = :newName', { replacements: { newName } },
      );
      if (!oldRow || !newRow) continue; // already merged (or never existed) on this database
      for (const table of REFERENCING_TABLES) {
        await queryInterface.sequelize.query(
          `UPDATE ${table} SET department_id = :newId WHERE department_id = :oldId`,
          { replacements: { newId: newRow.id, oldId: oldRow.id } },
        );
      }
      await queryInterface.sequelize.query('DELETE FROM departments WHERE id = :oldId', { replacements: { oldId: oldRow.id } });
    }
  },

  async down() {
    // Not reversible — which rows were "old" vs "new" isn't recoverable once merged and deleted.
  },
};

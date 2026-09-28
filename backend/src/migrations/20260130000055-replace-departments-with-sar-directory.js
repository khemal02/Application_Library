'use strict';
const { v4: uuidv4 } = require('uuid');

// Replaces the ALMS demo's 4-department SAP set with the real department directory the user
// asked to match (SAR India Digital's own "All Departments" dropdown, screenshotted across two
// scrolled captures). Existing users/applications/ideas that reference one of the 4 original
// departments keep pointing at the SAME row — renamed in place, not deleted — so no foreign key
// gets orphaned; only the name/description text changes for those 4. The other 34 are brand-new
// rows.
//
// On a fresh install this runs after the departments/teams seeder has already created the final
// SAR-named rows directly (see 20260101000003-departments-teams.js) — the RENAMES lookups find
// nothing (harmless no-op) and the 34 new-department insert below hits the department table's
// unique(name) constraint, so it's wrapped in an existence check rather than a plain bulkInsert.
const RENAMES = [
  { oldName: 'SAP S/4HANA Engineering', newName: 'IT' },
  { oldName: 'SAP Analytics & AI', newName: 'SAC Functional' },
  { oldName: 'SAP Fiori & UX', newName: 'Java App UI/IUX' },
  { oldName: 'SAP Cloud Operations', newName: 'Management' },
];

const NEW_DEPARTMENTS = [
  'Admin', 'BYD Finance', 'BYD Non-Finance', 'BYD/C4C PMO', 'BYD/C4C SDK', 'C4C Functional',
  'Finance', 'HR', 'Java App DevOps', 'Java App PMO', 'Java App Programmer',
  'RMG Account Manager', 'RMG Recruiter', 'S4H-MM/WM/EWM', 'S4H-SD', 'S4H ABAP', 'S4H BASIS',
  'S4H FICO', 'S4H HR', 'S4H MM/WM', 'S4H PI/CPI', 'S4H PM', 'S4H PMO', 'S4H PP/QM', 'S4H PS',
  'S4H SD', 'Sales - West', 'SAP Inside Sales', 'SAP S4HANA', 'SAP Sales', 'SF Functional',
  'SF PMO', 'Zieta Technologies Pvt Ltd', 'Zieta USA',
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    for (const r of RENAMES) {
      await queryInterface.sequelize.query(
        'UPDATE departments SET name = :newName, description = NULL, updated_at = :now WHERE name = :oldName',
        { replacements: { ...r, now } },
      );
    }

    const [existing] = await queryInterface.sequelize.query('SELECT name FROM departments');
    const existingNames = new Set(existing.map((d) => d.name));
    const toInsert = NEW_DEPARTMENTS.filter((name) => !existingNames.has(name))
      .map((name) => ({ id: uuidv4(), name, description: null, created_at: now, updated_at: now }));
    if (toInsert.length > 0) {
      await queryInterface.bulkInsert('departments', toInsert);
    }
  },

  async down(queryInterface) {
    const now = new Date();
    await queryInterface.bulkDelete('departments', { name: NEW_DEPARTMENTS });
    for (const r of RENAMES) {
      await queryInterface.sequelize.query(
        'UPDATE departments SET name = :oldName, updated_at = :now WHERE name = :newName',
        { replacements: { oldName: r.oldName, newName: r.newName, now } },
      );
    }
  },
};

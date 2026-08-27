'use strict';

// This app is being run for SAP — the generic demo department/team names are relabeled to
// realistic SAP business units. Same rows/ids/relationships (and the same users/applications
// still point at them), only the name/description text changes.
//
// On a fresh install this runs before the departments/teams seeder populates any rows, so the
// lookups below find nothing and this migration is a harmless no-op — the seeder already
// creates the SAP-named rows directly in that case.
const DEPARTMENT_RENAMES = [
  { oldName: 'Engineering', newName: 'SAP S/4HANA Engineering', description: 'Core S/4HANA platform and product engineering.' },
  { oldName: 'Data & AI', newName: 'SAP Analytics & AI', description: 'AI/ML tooling and applied data science for SAP Business AI.' },
  { oldName: 'Product & Design', newName: 'SAP Fiori & UX', description: 'Product management and UX/UI design for SAP Fiori experiences.' },
  { oldName: 'Operations', newName: 'SAP Cloud Operations', description: 'Internal operations and support tooling on SAP Business Technology Platform.' },
];

const TEAM_RENAMES = [
  { oldName: 'Platform Team', newName: 'S/4HANA Platform Team' },
  { oldName: 'AI Tools Team', newName: 'SAP Business AI Team' },
  { oldName: 'Web Apps Team', newName: 'Fiori Web Apps Team' },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    for (const r of DEPARTMENT_RENAMES) {
      await queryInterface.sequelize.query(
        'UPDATE departments SET name = :newName, description = :description, updated_at = :now WHERE name = :oldName',
        { replacements: { ...r, now } },
      );
    }
    for (const r of TEAM_RENAMES) {
      await queryInterface.sequelize.query(
        'UPDATE teams SET name = :newName, updated_at = :now WHERE name = :oldName',
        { replacements: { ...r, now } },
      );
    }
  },

  async down(queryInterface) {
    const now = new Date();
    for (const r of DEPARTMENT_RENAMES) {
      await queryInterface.sequelize.query(
        'UPDATE departments SET name = :oldName, updated_at = :now WHERE name = :newName',
        { replacements: { ...r, now } },
      );
    }
    for (const r of TEAM_RENAMES) {
      await queryInterface.sequelize.query(
        'UPDATE teams SET name = :oldName, updated_at = :now WHERE name = :newName',
        { replacements: { ...r, now } },
      );
    }
  },
};

'use strict';
const { v4: uuidv4 } = require('uuid');
const { DEPARTMENT_IDS } = require('./helpers/refs');

/**
 * Matches the real department directory this app's design reference (SAR India Digital) uses —
 * see the two "All Departments" dropdown screenshots this replaced the old 4-department SAP demo
 * set with. Only 4 of these are referenced by key elsewhere (the users/demo-applications/
 * demo-ideas seeders import DEPARTMENT_IDS.engineering etc.) — the rest just need to exist, so
 * they get a fresh id inline rather than a named key in helpers/refs.js.
 *
 * An already-seeded database doesn't re-run this file — see
 * 20260130000055-replace-departments-with-sar-directory.js, which renames the old 4 SAP-named
 * rows in place and inserts the same 34 extra rows for that case.
 */
const OTHER_DEPARTMENTS = [
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
    await queryInterface.bulkInsert('departments', [
      { id: DEPARTMENT_IDS.engineering, name: 'IT', description: null, created_at: now, updated_at: now },
      { id: DEPARTMENT_IDS.dataAi, name: 'SAC Functional', description: null, created_at: now, updated_at: now },
      { id: DEPARTMENT_IDS.productDesign, name: 'Java App UI/IUX', description: null, created_at: now, updated_at: now },
      { id: DEPARTMENT_IDS.operations, name: 'Management', description: null, created_at: now, updated_at: now },
      ...OTHER_DEPARTMENTS.map((name) => ({ id: uuidv4(), name, description: null, created_at: now, updated_at: now })),
    ]);
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('departments', null, {});
  },
};

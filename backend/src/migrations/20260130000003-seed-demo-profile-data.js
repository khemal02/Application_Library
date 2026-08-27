'use strict';

// Backfills the new Profile fields for the seeded demo accounts so the Profile & Settings module
// has realistic data to show immediately, and sets up a small reporting-manager chain
// (CEO <- Manager <- Team Lead <- Employees) to exercise the "Reporting Manager" field.
// Admin is deliberately left without most of these (no designation/manager) to also demonstrate
// the Profile tab's empty-state rendering for a account that hasn't filled its profile in yet.
const PROFILES = [
  {
    email: 'ceo@aams.local', employeeId: 'EMP-1001', phone: '+1-555-0101',
    designation: 'Chief Executive Officer', officeLocation: 'Newtown Square, PA, USA',
    joiningDate: '2022-01-10', bio: 'Leads the company\'s overall strategy and product direction.',
  },
  {
    email: 'manager@aams.local', employeeId: 'EMP-1002', phone: '+1-555-0102',
    designation: 'Engineering Manager, SAP S/4HANA', officeLocation: 'Walldorf, Germany',
    joiningDate: '2022-06-01', bio: 'Oversees the S/4HANA engineering organization and cross-team delivery.',
    reportingManagerEmail: 'ceo@aams.local',
  },
  {
    email: 'teamlead@aams.local', employeeId: 'EMP-1003', phone: '+49-6227-555103',
    designation: 'Team Lead, S/4HANA Platform', officeLocation: 'Walldorf, Germany',
    joiningDate: '2022-09-15', bio: 'Leads the S/4HANA Platform team, reviewing ideas and improvement suggestions.',
    reportingManagerEmail: 'manager@aams.local',
  },
  {
    email: 'employee3@aams.local', employeeId: 'EMP-1004', phone: '+91-80-5550-104',
    designation: 'ABAP Developer', officeLocation: 'Bangalore, India',
    joiningDate: '2023-02-20', bio: 'Builds and maintains ABAP extensions for the S/4HANA core.',
    reportingManagerEmail: 'teamlead@aams.local',
  },
  {
    email: 'employee4@aams.local', employeeId: 'EMP-1005', phone: '+91-80-5550-105',
    designation: 'SAP Business AI Engineer', officeLocation: 'Bangalore, India',
    joiningDate: '2023-04-10', bio: 'Builds AI-assisted features on top of SAP Business AI and BTP.',
    reportingManagerEmail: 'teamlead@aams.local',
  },
  {
    email: 'employee5@aams.local', employeeId: 'EMP-1006', phone: '+65-6555-0106',
    designation: 'SAP Fiori Frontend Developer', officeLocation: 'Singapore',
    joiningDate: '2023-05-22', bio: 'Builds Fiori/UI5 front ends for internal SAP-integrated tools.',
    reportingManagerEmail: 'teamlead@aams.local',
  },
  {
    email: 'employee1@aams.local', employeeId: 'EMP-1007', phone: '+1-555-0107',
    designation: 'SAP Cloud Operations Analyst', officeLocation: 'Newtown Square, PA, USA',
    joiningDate: '2023-07-03', bio: 'Monitors and supports internal applications running on SAP BTP.',
    reportingManagerEmail: 'teamlead@aams.local',
  },
  {
    email: 'employee2@aams.local', employeeId: 'EMP-1008', phone: '+65-6555-0108',
    designation: 'SAP Fiori UX Designer', officeLocation: 'Singapore',
    joiningDate: '2023-08-14', bio: 'Designs UX flows for SAP Fiori applications across the catalog.',
    reportingManagerEmail: 'teamlead@aams.local',
  },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    for (const p of PROFILES) {
      await queryInterface.sequelize.query(
        `UPDATE users SET employee_id = :employeeId, phone = :phone, designation = :designation,
           office_location = :officeLocation, joining_date = :joiningDate, bio = :bio, updated_at = :now
         WHERE email = :email`,
        { replacements: { ...p, now } },
      );
      if (p.reportingManagerEmail) {
        await queryInterface.sequelize.query(
          `UPDATE users SET reporting_manager_id = (SELECT id FROM users WHERE email = :managerEmail), updated_at = :now
           WHERE email = :email`,
          { replacements: { managerEmail: p.reportingManagerEmail, email: p.email, now } },
        );
      }
    }
  },

  async down(queryInterface) {
    const emails = PROFILES.map((p) => p.email);
    await queryInterface.sequelize.query(
      `UPDATE users SET employee_id = NULL, phone = NULL, designation = NULL, office_location = NULL,
         joining_date = NULL, bio = NULL, reporting_manager_id = NULL
       WHERE email IN (:emails)`,
      { replacements: { emails } },
    );
  },
};

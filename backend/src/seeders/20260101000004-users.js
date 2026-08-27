'use strict';
const bcrypt = require('bcryptjs');
const { ROLE_IDS, DEPARTMENT_IDS, USER_IDS } = require('./helpers/refs');

const DEMO_PASSWORD = 'Passw0rd!';

module.exports = {
  DEMO_PASSWORD,
  async up(queryInterface) {
    const now = new Date();
    const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);

    await queryInterface.bulkInsert('users', [
      { id: USER_IDS.sysAdmin, name: 'Alex Admin', email: 'admin@aams.local', password_hash: hash, role_id: ROLE_IDS.admin, department_id: DEPARTMENT_IDS.engineering, status: 'active', created_at: now, updated_at: now },
      {
        id: USER_IDS.superAdmin, name: 'Sara Ceo', email: 'ceo@aams.local', password_hash: hash, role_id: ROLE_IDS.ceo, department_id: DEPARTMENT_IDS.engineering, status: 'active',
        employee_id: 'EMP-1001', phone: '+1-555-0101', designation: 'Chief Executive Officer', office_location: 'Newtown Square, PA, USA', joining_date: '2022-01-10', bio: "Leads the company's overall strategy and product direction.",
        created_at: now, updated_at: now,
      },
      {
        id: USER_IDS.admin, name: 'Adam Manager', email: 'manager@aams.local', password_hash: hash, role_id: ROLE_IDS.manager, department_id: DEPARTMENT_IDS.engineering, status: 'active',
        employee_id: 'EMP-1002', phone: '+1-555-0102', designation: 'Engineering Manager, SAP S/4HANA', office_location: 'Walldorf, Germany', joining_date: '2022-06-01', bio: 'Oversees the S/4HANA engineering organization and cross-team delivery.',
        created_at: now, updated_at: now,
      },
      {
        id: USER_IDS.teamLead, name: 'Tara Teamlead', email: 'teamlead@aams.local', password_hash: hash, role_id: ROLE_IDS.team_lead, department_id: DEPARTMENT_IDS.engineering, status: 'active',
        employee_id: 'EMP-1003', phone: '+49-6227-555103', designation: 'Team Lead, S/4HANA Platform', office_location: 'Walldorf, Germany', joining_date: '2022-09-15', bio: 'Leads the S/4HANA Platform team, reviewing ideas and improvement suggestions.',
        created_at: now, updated_at: now,
      },
      {
        id: USER_IDS.devOne, name: 'Dev Kapoor', email: 'employee3@aams.local', password_hash: hash, role_id: ROLE_IDS.employee, department_id: DEPARTMENT_IDS.engineering, status: 'active',
        employee_id: 'EMP-1004', phone: '+91-80-5550-104', designation: 'ABAP Developer', office_location: 'Bangalore, India', joining_date: '2023-02-20', bio: 'Builds and maintains ABAP extensions for the S/4HANA core.',
        created_at: now, updated_at: now,
      },
      {
        id: USER_IDS.devTwo, name: 'Priya Devi', email: 'employee4@aams.local', password_hash: hash, role_id: ROLE_IDS.employee, department_id: DEPARTMENT_IDS.dataAi, status: 'active',
        employee_id: 'EMP-1005', phone: '+91-80-5550-105', designation: 'SAP Business AI Engineer', office_location: 'Bangalore, India', joining_date: '2023-04-10', bio: 'Builds AI-assisted features on top of SAP Business AI and BTP.',
        created_at: now, updated_at: now,
      },
      {
        id: USER_IDS.reviewer, name: 'Rita Employee', email: 'employee5@aams.local', password_hash: hash, role_id: ROLE_IDS.employee, department_id: DEPARTMENT_IDS.productDesign, status: 'active',
        employee_id: 'EMP-1006', phone: '+65-6555-0106', designation: 'SAP Fiori Frontend Developer', office_location: 'Singapore', joining_date: '2023-05-22', bio: 'Builds Fiori/UI5 front ends for internal SAP-integrated tools.',
        created_at: now, updated_at: now,
      },
      {
        id: USER_IDS.employeeOne, name: 'Ethan Employee', email: 'employee1@aams.local', password_hash: hash, role_id: ROLE_IDS.employee, department_id: DEPARTMENT_IDS.operations, status: 'active',
        employee_id: 'EMP-1007', phone: '+1-555-0107', designation: 'SAP Cloud Operations Analyst', office_location: 'Newtown Square, PA, USA', joining_date: '2023-07-03', bio: 'Monitors and supports internal applications running on SAP BTP.',
        created_at: now, updated_at: now,
      },
      {
        id: USER_IDS.employeeTwo, name: 'Emma Employee', email: 'employee2@aams.local', password_hash: hash, role_id: ROLE_IDS.employee, department_id: DEPARTMENT_IDS.productDesign, status: 'active',
        employee_id: 'EMP-1008', phone: '+65-6555-0108', designation: 'SAP Fiori UX Designer', office_location: 'Singapore', joining_date: '2023-08-14', bio: 'Designs UX flows for SAP Fiori applications across the catalog.',
        created_at: now, updated_at: now,
      },
    ]);

    // Set the reporting-manager chain as a second pass (safer than relying on multi-row INSERT
    // constraint-check ordering for self-referencing FKs): CEO <- Manager <- Team Lead <- Employees.
    const chain = [
      [USER_IDS.admin, USER_IDS.superAdmin],
      [USER_IDS.teamLead, USER_IDS.admin],
      [USER_IDS.devOne, USER_IDS.teamLead],
      [USER_IDS.devTwo, USER_IDS.teamLead],
      [USER_IDS.reviewer, USER_IDS.teamLead],
      [USER_IDS.employeeOne, USER_IDS.teamLead],
      [USER_IDS.employeeTwo, USER_IDS.teamLead],
    ];
    for (const [userId, managerId] of chain) {
      await queryInterface.sequelize.query(
        'UPDATE users SET reporting_manager_id = :managerId WHERE id = :userId',
        { replacements: { userId, managerId } },
      );
    }
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('users', null, {});
  },
};

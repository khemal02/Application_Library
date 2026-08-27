'use strict';
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { DEMO_PASSWORD } = require('./20260101000004-users');

/**
 * The original demo seed only gave ONE department (SAP S/4HANA Engineering) a full leadership
 * chain (team_lead + manager + ceo) — every other department has zero team_leads and zero
 * managers, so any idea outside that one department always falls back to org-wide review
 * eligibility. That's fine for the fallback path, but leaves no way to see department-MATCHED
 * routing for 5 of the 6 departments when testing live in the app.
 *
 * Looks departments/roles up by name/value rather than importing helpers/refs.js — that file's
 * UUIDs are regenerated on every `require`, so they only line up with the live DB within the
 * single seed run that first created those rows. Java and SAP ABAP in particular aren't even in
 * that original seeder (added later, straight to the live table), so name-based lookup is the only
 * way this seeder works against the actual current department set.
 */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);

    const [depts] = await queryInterface.sequelize.query('SELECT id, name FROM departments');
    const [roles] = await queryInterface.sequelize.query('SELECT id, name FROM roles');
    const deptId = (name) => {
      const row = depts.find((d) => d.name === name);
      if (!row) throw new Error(`Seeder expected a department named "${name}" to already exist`);
      return row.id;
    };
    const roleId = (name) => roles.find((r) => r.name === name).id;

    const managerRoleId = roleId('manager');
    const teamLeadRoleId = roleId('team_lead');
    const employeeRoleId = roleId('employee');

    const aiDept = deptId('SAP Analytics & AI');
    const fioriDept = deptId('SAP Fiori & UX');
    const opsDept = deptId('SAP Cloud Operations');
    const javaDept = deptId('Java');
    const abapDept = deptId('SAP ABAP');

    const ids = {
      aiManager: uuidv4(), aiTeamLead: uuidv4(),
      fioriManager: uuidv4(), fioriTeamLead: uuidv4(),
      opsManager: uuidv4(), opsTeamLead: uuidv4(),
      javaManager: uuidv4(), javaTeamLead: uuidv4(), javaEmployee: uuidv4(),
      abapManager: uuidv4(), abapTeamLead: uuidv4(), abapEmployee: uuidv4(),
    };

    const base = (overrides) => ({
      password_hash: hash, status: 'active', created_at: now, updated_at: now, ...overrides,
    });

    await queryInterface.bulkInsert('users', [
      base({
        id: ids.aiManager, name: 'Arjun Mehta', email: 'manager.ai@aams.local', role_id: managerRoleId, department_id: aiDept,
        employee_id: 'EMP-1009', phone: '+91-80-5550-109', designation: 'Engineering Manager, SAP Analytics & AI', office_location: 'Bangalore, India', joining_date: '2022-11-04', bio: 'Leads the Analytics & AI team building SAP Business AI features.',
      }),
      base({
        id: ids.aiTeamLead, name: 'Anika Rao', email: 'teamlead.ai@aams.local', role_id: teamLeadRoleId, department_id: aiDept,
        employee_id: 'EMP-1010', phone: '+91-80-5550-110', designation: 'Team Lead, SAP Analytics & AI', office_location: 'Bangalore, India', joining_date: '2023-01-16', bio: 'Reviews ideas and improvement suggestions for the Analytics & AI team.',
      }),
      base({
        id: ids.fioriManager, name: 'Fiona Lee', email: 'manager.fiori@aams.local', role_id: managerRoleId, department_id: fioriDept,
        employee_id: 'EMP-1011', phone: '+65-6555-0111', designation: 'Engineering Manager, SAP Fiori & UX', office_location: 'Singapore', joining_date: '2022-10-12', bio: 'Leads product and UX engineering for SAP Fiori experiences.',
      }),
      base({
        id: ids.fioriTeamLead, name: 'Felix Tan', email: 'teamlead.fiori@aams.local', role_id: teamLeadRoleId, department_id: fioriDept,
        employee_id: 'EMP-1012', phone: '+65-6555-0112', designation: 'Team Lead, SAP Fiori & UX', office_location: 'Singapore', joining_date: '2023-03-06', bio: 'Reviews ideas and improvement suggestions for the Fiori & UX team.',
      }),
      base({
        id: ids.opsManager, name: 'Clara Novak', email: 'manager.ops@aams.local', role_id: managerRoleId, department_id: opsDept,
        employee_id: 'EMP-1013', phone: '+1-555-0113', designation: 'Engineering Manager, SAP Cloud Operations', office_location: 'Newtown Square, PA, USA', joining_date: '2022-12-01', bio: 'Leads operations and support tooling on SAP BTP.',
      }),
      base({
        id: ids.opsTeamLead, name: 'Carlos Rivera', email: 'teamlead.ops@aams.local', role_id: teamLeadRoleId, department_id: opsDept,
        employee_id: 'EMP-1014', phone: '+1-555-0114', designation: 'Team Lead, SAP Cloud Operations', office_location: 'Newtown Square, PA, USA', joining_date: '2023-02-27', bio: 'Reviews ideas and improvement suggestions for the Cloud Operations team.',
      }),
      base({
        id: ids.javaManager, name: 'Jasmine Cole', email: 'manager.java@aams.local', role_id: managerRoleId, department_id: javaDept,
        employee_id: 'EMP-1015', phone: '+1-555-0115', designation: 'Engineering Manager, Java Platform', office_location: 'Austin, TX, USA', joining_date: '2022-09-19', bio: 'Leads the Java platform engineering team.',
      }),
      base({
        id: ids.javaTeamLead, name: 'Jordan Kim', email: 'teamlead.java@aams.local', role_id: teamLeadRoleId, department_id: javaDept,
        employee_id: 'EMP-1016', phone: '+1-555-0116', designation: 'Team Lead, Java Platform', office_location: 'Austin, TX, USA', joining_date: '2023-04-03', bio: 'Reviews ideas and improvement suggestions for the Java Platform team.',
      }),
      base({
        id: ids.javaEmployee, name: 'Jamie Foster', email: 'employee.java@aams.local', role_id: employeeRoleId, department_id: javaDept,
        employee_id: 'EMP-1017', phone: '+1-555-0117', designation: 'Java Backend Developer', office_location: 'Austin, TX, USA', joining_date: '2023-06-20', bio: 'Builds backend services on the Java platform.',
      }),
      base({
        id: ids.abapManager, name: 'Amara Chen', email: 'manager.abap@aams.local', role_id: managerRoleId, department_id: abapDept,
        employee_id: 'EMP-1018', phone: '+49-6227-555118', designation: 'Engineering Manager, SAP ABAP', office_location: 'Walldorf, Germany', joining_date: '2022-08-08', bio: 'Leads the SAP ABAP development team.',
      }),
      base({
        id: ids.abapTeamLead, name: 'Ahmed Farouk', email: 'teamlead.abap@aams.local', role_id: teamLeadRoleId, department_id: abapDept,
        employee_id: 'EMP-1019', phone: '+49-6227-555119', designation: 'Team Lead, SAP ABAP', office_location: 'Walldorf, Germany', joining_date: '2023-01-30', bio: 'Reviews ideas and improvement suggestions for the ABAP team.',
      }),
      base({
        id: ids.abapEmployee, name: 'Aisha Bello', email: 'employee.abap@aams.local', role_id: employeeRoleId, department_id: abapDept,
        employee_id: 'EMP-1020', phone: '+49-6227-555120', designation: 'ABAP Developer', office_location: 'Walldorf, Germany', joining_date: '2023-07-11', bio: 'Builds and maintains ABAP extensions and custom reports.',
      }),
    ]);

    // Reporting chain: CEO <- each new Manager <- their Team Lead <- their Employee (where one
    // exists). CEO's id is looked up rather than imported, same reasoning as departments/roles above.
    const [[ceo]] = await queryInterface.sequelize.query("SELECT id FROM users WHERE email = 'ceo@aams.local'");
    const chain = [
      [ids.aiManager, ceo.id], [ids.aiTeamLead, ids.aiManager],
      [ids.fioriManager, ceo.id], [ids.fioriTeamLead, ids.fioriManager],
      [ids.opsManager, ceo.id], [ids.opsTeamLead, ids.opsManager],
      [ids.javaManager, ceo.id], [ids.javaTeamLead, ids.javaManager], [ids.javaEmployee, ids.javaTeamLead],
      [ids.abapManager, ceo.id], [ids.abapTeamLead, ids.abapManager], [ids.abapEmployee, ids.abapTeamLead],
    ];
    for (const [userId, managerId] of chain) {
      await queryInterface.sequelize.query(
        'UPDATE users SET reporting_manager_id = :managerId WHERE id = :userId',
        { replacements: { userId, managerId } },
      );
    }
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('users', {
      email: [
        'manager.ai@aams.local', 'teamlead.ai@aams.local',
        'manager.fiori@aams.local', 'teamlead.fiori@aams.local',
        'manager.ops@aams.local', 'teamlead.ops@aams.local',
        'manager.java@aams.local', 'teamlead.java@aams.local', 'employee.java@aams.local',
        'manager.abap@aams.local', 'teamlead.abap@aams.local', 'employee.abap@aams.local',
      ],
    });
  },
};

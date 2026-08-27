'use strict';
const { v4: uuidv4 } = require('uuid');

/**
 * Centralized, in-memory-stable UUIDs shared across seeder files for one `db:seed:all` run.
 * Kept in `helpers/` (not the seeders root) so sequelize-cli's *.js glob does not try to run
 * this file as a seeder itself.
 */
module.exports = {
  ROLE_IDS: {
    admin: uuidv4(),
    ceo: uuidv4(),
    manager: uuidv4(),
    team_lead: uuidv4(),
    employee: uuidv4(),
  },
  DEPARTMENT_IDS: {
    engineering: uuidv4(),
    dataAi: uuidv4(),
    productDesign: uuidv4(),
    operations: uuidv4(),
  },
  USER_IDS: {
    sysAdmin: uuidv4(),
    superAdmin: uuidv4(),
    admin: uuidv4(),
    teamLead: uuidv4(),
    devOne: uuidv4(),
    devTwo: uuidv4(),
    reviewer: uuidv4(),
    employeeOne: uuidv4(),
    employeeTwo: uuidv4(),
  },
  APPLICATION_IDS: {
    appTracker: uuidv4(),
    supportBot: uuidv4(),
    invoiceOcr: uuidv4(),
  },
  IDEA_IDS: {
    ideaOne: uuidv4(),
    ideaTwo: uuidv4(),
    ideaThree: uuidv4(),
  },
};

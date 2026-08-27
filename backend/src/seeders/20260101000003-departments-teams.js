'use strict';
const { DEPARTMENT_IDS } = require('./helpers/refs');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert('departments', [
      { id: DEPARTMENT_IDS.engineering, name: 'SAP S/4HANA Engineering', description: 'Core S/4HANA platform and product engineering.', created_at: now, updated_at: now },
      { id: DEPARTMENT_IDS.dataAi, name: 'SAP Analytics & AI', description: 'AI/ML tooling and applied data science for SAP Business AI.', created_at: now, updated_at: now },
      { id: DEPARTMENT_IDS.productDesign, name: 'SAP Fiori & UX', description: 'Product management and UX/UI design for SAP Fiori experiences.', created_at: now, updated_at: now },
      { id: DEPARTMENT_IDS.operations, name: 'SAP Cloud Operations', description: 'Internal operations and support tooling on SAP Business Technology Platform.', created_at: now, updated_at: now },
    ]);
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('departments', null, {});
  },
};

'use strict';

// Narrows applications.status down to the 3 stages actually used: development, testing,
// deployment. Postgres can't drop enum values (see 20260130000016-add-under-review-status.js for
// the same constraint) — the old labels stay defined on the type but unreachable from here on;
// every existing row is remapped onto a new value and the model/validator/frontend options no
// longer offer the old ones.
module.exports = {
  async up(queryInterface) {
    // Must run as its own statement, not inside a transaction together with the UPDATE below —
    // Postgres forbids using a freshly-added enum value in the same transaction that added it.
    await queryInterface.sequelize.query("ALTER TYPE \"enum_applications_status\" ADD VALUE IF NOT EXISTS 'development'");
    await queryInterface.sequelize.query("ALTER TYPE \"enum_applications_status\" ADD VALUE IF NOT EXISTS 'testing'");
    await queryInterface.sequelize.query("ALTER TYPE \"enum_applications_status\" ADD VALUE IF NOT EXISTS 'deployment'");

    const [rows] = await queryInterface.sequelize.query(`
      UPDATE applications SET status = CASE
        WHEN status IN ('planning', 'on_hold') THEN 'development'
        WHEN status = 'in_progress' THEN 'testing'
        WHEN status IN ('completed', 'deprecated') THEN 'deployment'
        ELSE status
      END
      RETURNING id
    `);
    // eslint-disable-next-line no-console
    console.log(`  -> remapped ${rows.length} application row(s) onto development/testing/deployment`);

    await queryInterface.sequelize.query("ALTER TABLE applications ALTER COLUMN status SET DEFAULT 'development'");
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE applications SET status = CASE
        WHEN status = 'development' THEN 'planning'
        WHEN status = 'testing' THEN 'in_progress'
        WHEN status = 'deployment' THEN 'completed'
        ELSE status
      END
    `);
    await queryInterface.sequelize.query("ALTER TABLE applications ALTER COLUMN status SET DEFAULT 'planning'");
  },
};

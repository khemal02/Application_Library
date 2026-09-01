'use strict';

// Retires the empty "Known Issues" accordion in favor of Issues — a report-and-triage feature
// with severity/status/assignment/closure, living on the Application detail page. Carries the one
// live known_issues row across, then drops known_issues entirely and retires its module. See the
// project report (Issues RICC prompt, Stage 0/1) for the full discovery behind every mapping
// decision below.
//
// known_issues has no creator/reporter column at all (confirmed live at authoring time — D1), so
// reported_by always falls to the application's owner for every migrated row; this is the honest
// outcome, not a claim that the owner personally reported it. Severity carries across unchanged
// (identical enum, both 'low'|'medium'|'high'|'critical'). Status maps status: resolved ->
// resolved, active/monitoring -> known_limitation (both read as "not fixed, not a bug, but not
// actionable right now" until someone reopens it). `workaround`, when present, becomes
// closure_note (a known limitation's closure note IS the workaround); when empty, a placeholder
// explains where the row came from. closed_at is set to the source row's own updated_at as the
// best available proxy for "when this became true" — known_issues never recorded an actual
// triage/resolution timestamp of its own.
//
// Exactly 1 row existed at authoring time (checked live before writing this) — recorded here so
// down() can restore it (and only it) with its ORIGINAL status, rather than guessing at rows
// created after this migration ran. Same one-time-specific-dataset convention as
// 20260130000035's MOVED_IDS.
const MIGRATED_ROWS = [
  { id: 'afaa2c16-f77a-44c0-b6e4-a2f9aa21b9b7', originalStatus: 'monitoring' },
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable('issues', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
        application_id: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'applications', key: 'id' }, onDelete: 'CASCADE',
        },
        title: { type: Sequelize.STRING(200), allowNull: false },
        description: { type: Sequelize.TEXT },
        severity: { type: Sequelize.ENUM('low', 'medium', 'high', 'critical'), allowNull: false },
        status: {
          type: Sequelize.ENUM(
            'needs_triage', 'acknowledged', 'being_fixed', 'resolved',
            'known_limitation', 'duplicate', 'not_an_issue',
          ),
          allowNull: false,
          defaultValue: 'needs_triage',
        },
        reported_by: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'users', key: 'id' }, onDelete: 'CASCADE',
        },
        assignee_id: {
          type: Sequelize.UUID, allowNull: true,
          references: { model: 'users', key: 'id' }, onDelete: 'SET NULL',
        },
        affected_version: { type: Sequelize.STRING(50) },
        duplicate_of_id: { type: Sequelize.UUID, allowNull: true },
        closure_note: { type: Sequelize.TEXT },
        closed_at: { type: Sequelize.DATE },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      }, { transaction });

      // Self-referencing FK added as its own constraint, not inline — same convention this
      // codebase already uses for comments.parent_comment_id.
      await queryInterface.addConstraint('issues', {
        fields: ['duplicate_of_id'],
        type: 'foreign key',
        name: 'issues_duplicate_of_id_fkey',
        references: { table: 'issues', field: 'id' },
        onDelete: 'SET NULL',
        transaction,
      });
      await queryInterface.addIndex('issues', ['application_id', 'status'], { transaction });

      // Carry every live known_issues row across — generic (not filtered to MIGRATED_ROWS) since
      // this is a full-table migration, not a subset move.
      await queryInterface.sequelize.query(`
        INSERT INTO issues (
          id, application_id, title, description, severity, status, reported_by,
          closure_note, closed_at, created_at, updated_at
        )
        SELECT
          ki.id, ki.application_id, ki.title, ki.description,
          ki.severity::text::enum_issues_severity,
          (CASE WHEN ki.status = 'resolved' THEN 'resolved' ELSE 'known_limitation' END)::enum_issues_status,
          a.owner_id,
          COALESCE(NULLIF(ki.workaround, ''), 'Migrated from Known Issues.'),
          ki.updated_at,
          ki.created_at, ki.updated_at
        FROM known_issues ki
        JOIN applications a ON a.id = ki.application_id
        WHERE a.owner_id IS NOT NULL
      `, { transaction });

      // known_issues rows whose application has no owner can't satisfy reported_by's NOT NULL
      // constraint — none exist today (checked live), but guard rather than silently dropping data
      // if that ever changes before this runs elsewhere.
      const [[{ count: skipped }]] = await queryInterface.sequelize.query(`
        SELECT COUNT(*)::int AS count FROM known_issues ki
        JOIN applications a ON a.id = ki.application_id
        WHERE a.owner_id IS NULL
      `, { transaction });
      if (skipped > 0) {
        throw new Error(`${skipped} known_issues row(s) belong to an application with no owner — cannot set reported_by. Resolve before migrating.`);
      }

      await queryInterface.dropTable('known_issues', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_known_issues_severity";', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_known_issues_status";', { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable('known_issues', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
        application_id: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'applications', key: 'id' }, onDelete: 'CASCADE',
        },
        title: { type: Sequelize.STRING(200), allowNull: false },
        description: { type: Sequelize.TEXT },
        severity: { type: Sequelize.ENUM('low', 'medium', 'high', 'critical'), allowNull: false, defaultValue: 'medium' },
        status: { type: Sequelize.ENUM('active', 'monitoring', 'resolved'), allowNull: false, defaultValue: 'active' },
        workaround: { type: Sequelize.TEXT },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      }, { transaction });
      await queryInterface.addIndex('known_issues', ['application_id', 'status'], { transaction });

      // Restore exactly the rows this migration moved, with their ORIGINAL status — the
      // active/monitoring distinction was lost when both collapsed into known_limitation, so it's
      // restored from MIGRATED_ROWS rather than guessed back from the current issues row.
      for (const { id, originalStatus } of MIGRATED_ROWS) {
        await queryInterface.sequelize.query(`
          INSERT INTO known_issues (id, application_id, title, description, severity, status, workaround, created_at, updated_at)
          SELECT id, application_id, title, description, severity::text::enum_known_issues_severity,
            :originalStatus::enum_known_issues_status,
            CASE WHEN closure_note = 'Migrated from Known Issues.' THEN NULL ELSE closure_note END,
            created_at, updated_at
          FROM issues WHERE id = :id
        `, { replacements: { id, originalStatus }, transaction });
      }

      await queryInterface.sequelize.query(
        'DELETE FROM issues WHERE id IN (:ids)',
        { replacements: { ids: MIGRATED_ROWS.map((r) => r.id) }, transaction },
      );

      await queryInterface.dropTable('issues', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_issues_severity";', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_issues_status";', { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};

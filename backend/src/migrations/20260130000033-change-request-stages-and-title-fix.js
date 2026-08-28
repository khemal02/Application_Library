'use strict';

const { v4: uuidv4 } = require('uuid');

// The exact rows up() moved content for on this database, captured at authoring time (see the
// project report). down() is deliberately pinned to these three ids — NOT to "whichever rows
// currently have a non-null description" — so it can never undo a real change request's
// description that gets written after this migration ran; it just no-ops on any id that isn't
// one of these three (including if one has since been deleted).
const TOUCHED_IDS = [
  '02292b6d-11c9-4060-9327-09fbc86a4170',
  '43c04e4e-a06b-466a-b68e-a838cabb3ef9',
  'd9e78cd9-0e5e-4990-b1d3-b2bb9b99104e',
];

// First 80 chars, cut at the last word boundary at or before 80, `…` appended if anything was
// cut, trimmed. Empty input -> 'Change request'.
function deriveTitle(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return 'Change request';
  if (trimmed.length <= 80) return trimmed;
  const slice = trimmed.slice(0, 80);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trim();
  return `${cut}…`;
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1. The collapsed single-field create form has only ever written to `title`; `description`
      // has never been written to by anything. Move the free-text content to where it belongs and
      // derive a real short title from it. Dynamic WHERE so this is correct wherever/whenever it
      // runs — on this database it resolves to exactly TOUCHED_IDS above.
      const [rows] = await queryInterface.sequelize.query(
        'SELECT id, title FROM change_requests WHERE description IS NULL',
        { transaction },
      );
      // eslint-disable-next-line no-console
      console.log(`[033] moving content for ${rows.length} change request(s)`);
      for (const row of rows) {
        const newTitle = deriveTitle(row.title);
        await queryInterface.sequelize.query(
          'UPDATE change_requests SET description = :description, title = :title WHERE id = :id',
          { replacements: { description: row.title, title: newTitle, id: row.id }, transaction },
        );
        const oldPreview = row.title.length > 100 ? `${row.title.slice(0, 100)}…` : row.title;
        // eslint-disable-next-line no-console
        console.log(`[033]   ${row.id}: title "${newTitle}" <- was "${oldPreview}"`);
      }

      // 2. Reserved bridge column for a later, separate Ideas -> change request feature. Nothing
      // writes to it or reads it as of this migration.
      await queryInterface.addColumn('change_requests', 'idea_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'ideas', key: 'id' },
        onDelete: 'SET NULL',
      }, { transaction });

      // 3. The per-change-request delivery track.
      await queryInterface.createTable('change_request_stages', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
        change_request_id: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'change_requests', key: 'id' }, onDelete: 'CASCADE',
        },
        stage: { type: Sequelize.ENUM('development', 'testing', 'deployment'), allowNull: false },
        status: { type: Sequelize.ENUM('not_started', 'in_progress', 'complete'), allowNull: false, defaultValue: 'not_started' },
        assignee_id: {
          type: Sequelize.UUID, allowNull: true,
          references: { model: 'users', key: 'id' }, onDelete: 'SET NULL',
        },
        start_date: { type: Sequelize.DATEONLY, allowNull: true },
        end_date: { type: Sequelize.DATEONLY, allowNull: true },
        notes: { type: Sequelize.TEXT, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      }, { transaction });
      await queryInterface.addConstraint('change_request_stages', {
        fields: ['change_request_id', 'stage'],
        type: 'unique',
        name: 'change_request_stages_change_request_id_stage_unique',
        transaction,
      });

      // 4. Seed three not_started rows for every change request that already exists.
      const [existingCRs] = await queryInterface.sequelize.query('SELECT id FROM change_requests', { transaction });
      const now = new Date();
      const stageRows = [];
      existingCRs.forEach((cr) => {
        ['development', 'testing', 'deployment'].forEach((stage) => {
          stageRows.push({
            id: uuidv4(), change_request_id: cr.id, stage, status: 'not_started', created_at: now, updated_at: now,
          });
        });
      });
      if (stageRows.length) {
        await queryInterface.bulkInsert('change_request_stages', stageRows, { transaction });
      }
      // eslint-disable-next-line no-console
      console.log(`[033] seeded ${stageRows.length} stage row(s) for ${existingCRs.length} change request(s) (expected ${existingCRs.length * 3})`);

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable('change_request_stages', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_change_request_stages_stage";', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_change_request_stages_status";', { transaction });
      await queryInterface.removeColumn('change_requests', 'idea_id', { transaction });

      // Restore content for exactly the rows up() touched. No-ops harmlessly for any id that
      // isn't one of TOUCHED_IDS or that no longer exists.
      await queryInterface.sequelize.query(
        'UPDATE change_requests SET title = description, description = NULL WHERE id IN (:ids) AND description IS NOT NULL',
        { replacements: { ids: TOUCHED_IDS }, transaction },
      );

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};

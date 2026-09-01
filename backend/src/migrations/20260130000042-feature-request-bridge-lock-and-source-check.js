'use strict';

// Repairs the feature-request -> change-request bridge (see the project report — "Feature Request
// -> Change Request bridge" RICC prompt). Three independent things, in one migration:
//
//   1. `title` relaxed to nullable — a linked row (feature_request_id or issue_id set) reads its
//      text through the association from here on, same shape the issue path already uses.
//   2. `idea_id` dropped — added by 20260130000033 as a "reserved bridge column for a later,
//      separate Ideas -> change request feature" that discovery proved will never be built on
//      `ideas` (that whole concept moved to `feature_requests` in the Ideas/Feature-Requests split
//      — see 20260130000035 — and `ideas.category = 'existing_app_feature'` has had zero reachable
//      rows since). Zero non-null rows exist; nothing reads or writes it. down() re-adds it exactly
//      as 20260130000033 did (nullable, FK -> ideas.id, ON DELETE SET NULL) — nothing is lost.
//   3. The CHECK constraint and the two partial unique indexes that make "one source, one change
//      request, enforced by the database" real for both existing source columns.
//
// Plus a one-time, specific-dataset backfill of the two live feature-request-sourced rows (same
// TOUCHED_IDS convention as 20260130000033's own migration): the `implemented` one is left
// completely untouched (a human already carried it through — see the project report's A1), the
// `pending` one gets its copied text nulled out (it matches its feature request character-for-
// character, confirmed live before writing this) and its status flipped to `approved` — discovery
// proved there is no UI or API-invoked path that could ever have moved it out of `pending` itself.
const BACKFILL_ROW = {
  id: '3ec58aeb-1d44-4bbd-9276-2439f218b90e',
  originalTitle: 'change request',
  originalDescription: 'Bali is predominantly a Hindu country. Bali is known for its elaborate, traditional dancing. The dancing is inspired by its Hindi beliefs. Most of the dancing portrays tales of good versus evil. To watch the dancing is a breathtaking experience. Lombok has some impressive points of interest – the majestic Gunung Rinjani is an active volcano. It is the second highest peak in Indonesia. Art is a Balinese passion. Batik paintings and carved statues make popular souvenirs. Artists can be seen whittling and painting on the streets, particularly in Ubud. It is easy to appreciate each island as an attractive tourist destination. Majestic scenery; rich culture; white sands and warm, azure waters draw visitors like magnets every year. Snorkelling and diving around the nearby Gili Islands is magnificent. Marine fish, starfish, turtles and coral reef are present in abundance. Bali and Lombok are part of the Indonesian archipelago. Bali has some spectacular temples. The most significant is the Mother Temple, Besakih. The inhabitants of Lombok are mostly Muslim with a Hindu minority. Lombok remains the most understated of the two islands. Lombok has several temples worthy of a visit, though they are less prolific. Bali and Lombok are neighbouring islands.',
  originalStatus: 'pending',
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.changeColumn('change_requests', 'title', {
        type: Sequelize.TEXT, allowNull: true,
      }, { transaction });

      await queryInterface.removeColumn('change_requests', 'idea_id', { transaction });

      await queryInterface.sequelize.query(`
        UPDATE change_requests SET title = NULL, description = NULL, status = 'approved'
        WHERE id = :id
      `, { replacements: { id: BACKFILL_ROW.id }, transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE change_requests ADD CONSTRAINT change_requests_source_check
        CHECK (title IS NOT NULL OR feature_request_id IS NOT NULL OR issue_id IS NOT NULL)
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX change_requests_feature_request_id_unique
        ON change_requests (feature_request_id) WHERE feature_request_id IS NOT NULL
      `, { transaction });
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX change_requests_issue_id_unique
        ON change_requests (issue_id) WHERE issue_id IS NOT NULL
      `, { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS change_requests_issue_id_unique', { transaction });
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS change_requests_feature_request_id_unique', { transaction });
      await queryInterface.sequelize.query('ALTER TABLE change_requests DROP CONSTRAINT IF EXISTS change_requests_source_check', { transaction });

      await queryInterface.sequelize.query(`
        UPDATE change_requests SET title = :title, description = :description, status = :status
        WHERE id = :id
      `, {
        replacements: {
          id: BACKFILL_ROW.id, title: BACKFILL_ROW.originalTitle,
          description: BACKFILL_ROW.originalDescription, status: BACKFILL_ROW.originalStatus,
        },
        transaction,
      });

      await queryInterface.addColumn('change_requests', 'idea_id', {
        type: Sequelize.UUID, allowNull: true,
        references: { model: 'ideas', key: 'id' }, onDelete: 'SET NULL',
      }, { transaction });

      // Re-applying NOT NULL only succeeds if every row already has a title at this point — true
      // immediately after up() (only the row above was ever nulled, and it's restored just above),
      // but this will fail if new NULL-title linked rows were created via Stage 1b in between.
      // Same expectation this project's other down() migrations carry: tested up -> down -> up
      // back-to-back, not months later against arbitrary accumulated data.
      await queryInterface.changeColumn('change_requests', 'title', {
        type: Sequelize.TEXT, allowNull: false,
      }, { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};

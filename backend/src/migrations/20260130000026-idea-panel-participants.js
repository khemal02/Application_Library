'use strict';

// Replaces the fixed three-role chain (team_lead -> manager -> ceo) with an open panel the
// submitter composes: any number of REVIEWERS (advisory, never move the idea) and any number of
// APPROVERS (all must approve; any one reject ends it). One row per PERSON per idea now, not one
// row per ROLE SLOT — hence dropping UNIQUE(idea_id, role_name) for UNIQUE(idea_id, user_id).
//
// `role_name` is kept, now nullable, for the 7 legacy rows only — every row from here on leaves it
// NULL and is identified by `user_id`/`kind` instead. `decision` is also relaxed to nullable here,
// which the original spec for this migration didn't call out as a separate column change but is
// unavoidable: backfill (b) below seeds panel rows for people who haven't voted yet, and the
// existing `decision` column was NOT NULL. Still just 'approve'/'reject'/'request_changes' — no
// new vocabulary, per instruction; `request_changes` is dead going forward (same as it already is
// for Suggestions) but the enum value stays, same precedent as every other retired-but-not-dropped
// enum value in this codebase.
//
// Filename note: the spec named this `...025-idea-panel-participants.js`, but 025 was already
// taken by `20260130000025-add-idea-technologies-and-efficiency.js` — bumped to 026, same suffix.
module.exports = {
  async up(queryInterface, Sequelize) {
    const { QueryTypes } = Sequelize;

    await queryInterface.addColumn('idea_reviews', 'user_id', {
      type: Sequelize.UUID,
      allowNull: true, // tightened to NOT NULL below, once every existing row has a value
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    });
    await queryInterface.addColumn('idea_reviews', 'kind', {
      type: Sequelize.STRING(20), // 'reviewer' | 'approver' — plain varchar per spec, not an enum
      allowNull: true, // tightened to NOT NULL below
    });
    await queryInterface.addColumn('idea_reviews', 'added_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('idea_reviews', 'added_at', { type: Sequelize.DATE, allowNull: true });

    // (a) Existing rows: user_id = reviewer_id, kind derived from role_name, added_at = created_at
    // (the closest honest proxy for "when was this participant added" that exists for these rows).
    const [backfilled] = await queryInterface.sequelize.query(`
      UPDATE idea_reviews
      SET user_id = reviewer_id,
          kind = CASE role_name WHEN 'ceo' THEN 'approver' ELSE 'reviewer' END,
          added_at = created_at
      WHERE user_id IS NULL
      RETURNING id
    `);
    console.log(`  -> backfilled ${backfilled.length} existing idea_reviews row(s) with user_id/kind/added_at`);

    await queryInterface.changeColumn('idea_reviews', 'role_name', { type: Sequelize.STRING(40), allowNull: true });
    await queryInterface.changeColumn('idea_reviews', 'decision', {
      type: Sequelize.ENUM('approve', 'request_changes', 'reject'), allowNull: true,
    });
    // Safe to tighten now — (a) above gave every existing row a value, and every row (b) inserts
    // below always supplies one too.
    await queryInterface.changeColumn('idea_reviews', 'user_id', { type: Sequelize.UUID, allowNull: false });
    await queryInterface.changeColumn('idea_reviews', 'kind', { type: Sequelize.STRING(20), allowNull: false });

    await queryInterface.removeConstraint('idea_reviews', 'idea_reviews_idea_id_role_name_unique');
    await queryInterface.addConstraint('idea_reviews', {
      fields: ['idea_id', 'user_id'],
      type: 'unique',
      name: 'idea_reviews_idea_id_user_id_unique',
    });

    // (b) Every under_review idea with NO panel rows yet gets seeded from the chain that was about
    // to run on it: the functional-area-matched Team Lead/Manager, ONLY when the match is
    // unambiguous (exactly one active holder of that role for the idea's functional area — the
    // same uniqueness users.service.js#assertFunctionalAreaOwnershipAvailable already enforces
    // live), as REVIEWERS; every active CEO (never functional-area-matched, so never ambiguous —
    // see utils/reviewPanel.js#eligibleReviewers) as APPROVER. A null functionalArea, or a role
    // with zero specific matches, is exactly the org-wide-fallback case eligibleReviewers() would
    // widen to live — nothing is inserted for that slot rather than guessing among several
    // equally-plausible people and fabricating history that never happened. Gaps are reported, not
    // silently left unexplained.
    const candidateIdeas = await queryInterface.sequelize.query(`
      SELECT i.id, i.idea_number AS "ideaNumber", i.functional_area AS "functionalArea"
      FROM ideas i
      WHERE i.status = 'under_review'
        AND NOT EXISTS (SELECT 1 FROM idea_reviews ir WHERE ir.idea_id = i.id)
    `, { type: QueryTypes.SELECT });

    const gaps = [];
    for (const idea of candidateIdeas) {
      let reviewersAssigned = 0;
      if (idea.functionalArea) {
        for (const roleName of ['team_lead', 'manager']) {
          const matches = await queryInterface.sequelize.query(`
            SELECT u.id FROM users u
            JOIN roles r ON r.id = u.role_id
            WHERE r.name = :roleName AND u.status = 'active'
              AND u.functional_areas @> ARRAY[:fa]::varchar[]
          `, { replacements: { roleName, fa: idea.functionalArea }, type: QueryTypes.SELECT });
          if (matches.length === 1) {
            await queryInterface.sequelize.query(`
              INSERT INTO idea_reviews (id, idea_id, user_id, kind, decision, added_at, created_at, updated_at)
              VALUES (gen_random_uuid(), :ideaId, :userId, 'reviewer', NULL, NOW(), NOW(), NOW())
            `, { replacements: { ideaId: idea.id, userId: matches[0].id } });
            reviewersAssigned += 1;
          }
        }
      }
      if (reviewersAssigned < 2) {
        gaps.push({ idea: idea.ideaNumber, functionalArea: idea.functionalArea, reviewersAssigned });
      }

      const ceos = await queryInterface.sequelize.query(`
        SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
        WHERE r.name = 'ceo' AND u.status = 'active'
      `, { type: QueryTypes.SELECT });
      for (const ceo of ceos) {
        await queryInterface.sequelize.query(`
          INSERT INTO idea_reviews (id, idea_id, user_id, kind, decision, added_at, created_at, updated_at)
          VALUES (gen_random_uuid(), :ideaId, :userId, 'approver', NULL, NOW(), NOW(), NOW())
        `, { replacements: { ideaId: idea.id, userId: ceo.id } });
      }
    }
    console.log(`  -> seeded panels for ${candidateIdeas.length} in-flight idea(s)`);
    console.log(`  -> ${gaps.length} idea(s) have a reviewer gap (ambiguous/no functional-area match): ${JSON.stringify(gaps)}`);

    // No notifications fire from this migration — see the identical ruling in
    // 20260130000023-collapse-to-review-chain.js for why (a bulk data migration, not a live event).
  },

  // Reverses schema AND the rows (b) created. Before this migration `role_name` was NOT NULL, so
  // every pre-existing row HAS one — `role_name IS NULL` identifies exactly (b)'s seeded rows,
  // deterministically, not "as best we can tell": the old constraint guarantees no genuine
  // pre-migration row could ever have had a null role_name. The one thing this genuinely cannot
  // recover is which of the 7 legacy rows had their user_id/kind DERIVED (vs some hypothetical
  // world where they'd always had a real column there) — that provenance is lost the moment the
  // columns are dropped, even though the values themselves are trivially recomputable by re-
  // running up() again, deterministically, from reviewer_id/role_name.
  async down(queryInterface, Sequelize) {
    const [deleted] = await queryInterface.sequelize.query(`
      DELETE FROM idea_reviews WHERE role_name IS NULL RETURNING id
    `);
    console.log(`  -> deleted ${deleted.length} seeded panel row(s) (role_name IS NULL identifies them uniquely)`);

    await queryInterface.removeConstraint('idea_reviews', 'idea_reviews_idea_id_user_id_unique');
    await queryInterface.addConstraint('idea_reviews', {
      fields: ['idea_id', 'role_name'],
      type: 'unique',
      name: 'idea_reviews_idea_id_role_name_unique',
    });
    // Safe to tighten again now that (b)'s rows are gone — every remaining row has both.
    await queryInterface.changeColumn('idea_reviews', 'role_name', { type: Sequelize.STRING(40), allowNull: false });
    await queryInterface.changeColumn('idea_reviews', 'decision', {
      type: Sequelize.ENUM('approve', 'request_changes', 'reject'), allowNull: false,
    });
    await queryInterface.removeColumn('idea_reviews', 'added_at');
    await queryInterface.removeColumn('idea_reviews', 'added_by');
    await queryInterface.removeColumn('idea_reviews', 'kind');
    await queryInterface.removeColumn('idea_reviews', 'user_id');
  },
};

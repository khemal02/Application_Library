'use strict';

// Retires `submitted` as a live workflow stage — Phase 3 creates ideas directly at `discussion`
// instead. The enum value is NOT removed (status_history rows still reference it, same reasoning
// as the under_review migration), and IDEA_STATUS_LABELS keeps its label so those historical rows
// keep rendering. This migration only moves in-flight rows off `submitted`, for BOTH categories —
// unlike the under_review migration, this phase's rules apply uniformly to new_idea and
// existing_app_feature alike.
module.exports = {
  async up(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(`
      UPDATE ideas SET status = 'discussion'
      WHERE status = 'submitted'
      RETURNING id
    `);
    // eslint-disable-next-line no-console
    console.log(`  -> moved ${rows.length} in-flight row(s) (both categories) from submitted to discussion`);
  },

  async down(queryInterface) {
    // Best-effort inverse, not exact — it can't know which rows THIS migration moved. Instead it
    // reverses any row currently at 'discussion' with NO status_history entry recording a real
    // transition into discussion: a row this migration moved never got one (the move was a raw
    // UPDATE, not a transition() call), so absence of that row is the signal. A idea created
    // directly at 'discussion' post-Phase-3 (no submitted stage to have come from) also has no such
    // entry and gets sent to 'submitted' by this same rule — which is the correct behavior for a
    // rollback to the pre-Phase-3 world, where every idea started at submitted.
    const [rows] = await queryInterface.sequelize.query(`
      UPDATE ideas SET status = 'submitted'
      WHERE status = 'discussion'
        AND NOT EXISTS (
          SELECT 1 FROM status_history
          WHERE status_history.entity_type = 'idea'
            AND status_history.entity_id = ideas.id
            AND status_history.to_status = 'discussion'
        )
      RETURNING id
    `);
    // eslint-disable-next-line no-console
    console.log(`  -> moved ${rows.length} row(s) back from discussion to submitted (best-effort inverse)`);
  },
};

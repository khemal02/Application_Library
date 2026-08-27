'use strict';

// Collapses the four-stage machine (discussion -> under_review -> approved -> development_ready)
// into a two-outcome chain sitting entirely at under_review until a terminal decision:
//   under_review -> approved (Application created) | rejected
// `discussion` stops being a gate — ideas are created directly at under_review from now on (see
// idea.model.js's new default) — so every idea currently AT discussion moves there too, landing in
// the right Team Leads' queues immediately. `development_ready` is retired outright: an idea that
// already graduated is, by this model, simply approved.
//
// Also merges the two Ideas discussion surfaces (NotesThread's `idea_note` and CommentThread's
// `idea`) into one `idea`-typed thread — same `comments` table, only the entityType differs today.
// Scoped to ideas only: `suggestion_note` (Suggestions' own NotesThread usage) is untouched.
//
// No notifications fire from this migration. Twelve ideas landing in queues at once is intended;
// twelve bell notifications about weeks-old ideas is noise, not signal.
module.exports = {
  async up(queryInterface) {
    const [toUnderReview] = await queryInterface.sequelize.query(`
      UPDATE ideas SET status = 'under_review' WHERE status = 'discussion' RETURNING id
    `);
    console.log(`  -> moved ${toUnderReview.length} idea(s) from discussion to under_review`);

    const [toApproved] = await queryInterface.sequelize.query(`
      UPDATE ideas SET status = 'approved' WHERE status = 'development_ready' RETURNING id
    `);
    console.log(`  -> moved ${toApproved.length} idea(s) from development_ready to approved`);

    const [mergedComments] = await queryInterface.sequelize.query(`
      UPDATE comments SET entity_type = 'idea' WHERE entity_type = 'idea_note' RETURNING id
    `);
    console.log(`  -> merged ${mergedComments.length} idea_note comment(s) into the idea thread`);
  },

  // Best-effort, and only for the status changes — NOT the comment merge (see below).
  //
  // under_review -> discussion: only for a row with no status_history entry recording a REAL
  // transition into under_review — that absence is exactly what distinguishes "this row was
  // sitting at discussion and got swept forward by this migration" from "this row legitimately
  // reached under_review through the old panel before this migration ever ran." The latter must
  // not be pushed back to discussion; nothing in this migration touched it.
  //
  // approved <- development_ready: undoing this precisely is impossible for the same reason retiring
  // development_ready is safe going forward — once collapsed, "approved because it graduated" and
  // "approved because a CEO approved it" are indistinguishable. This inverse is therefore
  // intentionally NOT attempted; only the under_review/discussion edge reverses.
  //
  // The comment merge (idea_note -> idea) is NOT reversed here, by design, per this migration's own
  // documentation above: once merged, there is no reliable way to tell which `idea`-typed rows were
  // originally posted as `idea_note` vs originally as `idea` without having snapshotted their ids
  // before the UPDATE — which this migration does not do. Rolling back the status changes while
  // leaving the comment merge in place is an accepted, documented asymmetry of this down().
  async down(queryInterface) {
    const [backToDiscussion] = await queryInterface.sequelize.query(`
      UPDATE ideas SET status = 'discussion'
      WHERE status = 'under_review'
        AND NOT EXISTS (
          SELECT 1 FROM status_history
          WHERE status_history.entity_type = 'idea'
            AND status_history.entity_id = ideas.id
            AND status_history.to_status = 'under_review'
        )
      RETURNING id
    `);
    console.log(`  -> moved ${backToDiscussion.length} row(s) back from under_review to discussion (best-effort inverse)`);
    console.log('  -> development_ready<->approved and the idea_note/idea comment merge are NOT reversed — see comment above.');
  },
};

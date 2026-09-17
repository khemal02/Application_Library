'use strict';

// Manual, reorderable build-sequence rank — "this one, then this one" — distinct from `priority`
// (an urgency description; multiple tracks can share "High") and from `target_go_live`/`startDate`
// (planning dates, not a decision about sequence). Nullable float, not an integer position: a
// reorder between two neighbors sets the moved row's rank to the midpoint of theirs, so moving one
// item never requires rewriting every other row's rank — only a full renumber (never needed in
// practice at this app's data volumes) would.
//
// Only ever meaningful for a track that's `active` AND whose Development stage is still
// `not_started` — every other track (already moved to build, on hold, live, cancelled) has a NULL
// rank and is never part of the ranked "Waiting to start" queue. Backfilled below for whichever of
// today's tracks are currently in that state, in the same default order the list page already
// sorts by (priority critical->low, then target_go_live ascending, nulls last) — so existing
// tracks start in a sensible order rather than landing unranked.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('application_tracks', 'queue_rank', {
      type: Sequelize.DOUBLE,
      allowNull: true,
    });

    const [eligible] = await queryInterface.sequelize.query(`
      SELECT at.id
      FROM application_tracks at
      JOIN application_track_stages ats
        ON ats.application_track_id = at.id AND ats.stage = 'development'
      WHERE at.status = 'active' AND ats.status = 'not_started'
      ORDER BY
        CASE at.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
        at.target_go_live ASC NULLS LAST,
        at.created_at ASC
    `);

    for (let i = 0; i < eligible.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.sequelize.query(
        'UPDATE application_tracks SET queue_rank = :rank WHERE id = :id',
        { replacements: { rank: (i + 1) * 1000, id: eligible[i].id } },
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('application_tracks', 'queue_rank');
  },
};

'use strict';

// Extends the same manual build-sequence rank application_tracks already has (see
// 20260130000053-add-application-track-queue-rank.js) to change_requests, specifically so an
// approved feature request's resulting change request can sit in the SAME shared "Idea
// Prioritization" ranked queue as an approved idea's track — both are, at that point, just "work
// waiting to start Development," competing for the same bandwidth.
//
// Only ever meaningful for a change request that's `approved`, whose Development stage is still
// `not_started`, AND that came from a feature request (feature_request_id NOT NULL) — a directly-
// raised or issue-converted change request was never part of Idea Prioritization's scope and stays
// out of this queue entirely (queue_rank stays NULL for those, same as any track that's already
// moved to build). Backfilled below by simply appending today's eligible feature-request-sourced
// change requests to the BOTTOM of whatever the current ranked queue already is — the same
// "newly-eligible joins at the end, not interleaved" rule this app already uses everywhere else a
// track (re-)enters the queue (see applicationTracking.service.js#resume).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('change_requests', 'queue_rank', {
      type: Sequelize.DOUBLE,
      allowNull: true,
    });

    const [[{ max_rank: maxRank }]] = await queryInterface.sequelize.query(`
      SELECT GREATEST(
        (SELECT MAX(queue_rank) FROM application_tracks),
        (SELECT MAX(queue_rank) FROM change_requests)
      ) AS max_rank
    `);
    let nextRank = (maxRank || 0);

    const [eligible] = await queryInterface.sequelize.query(`
      SELECT cr.id
      FROM change_requests cr
      JOIN change_request_stages crs
        ON crs.change_request_id = cr.id AND crs.stage = 'development'
      WHERE cr.status = 'approved' AND crs.status = 'not_started' AND cr.feature_request_id IS NOT NULL
      ORDER BY cr.created_at ASC
    `);

    for (let i = 0; i < eligible.length; i += 1) {
      nextRank += 1000;
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.sequelize.query(
        'UPDATE change_requests SET queue_rank = :rank WHERE id = :id',
        { replacements: { rank: nextRank, id: eligible[i].id } },
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('change_requests', 'queue_rank');
  },
};

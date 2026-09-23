const { Op } = require('sequelize');
const { ApplicationTrack, ChangeRequest } = require('../../models');

// Shared by applicationTracking.service.js (application_tracks) and changeRequests.service.js
// (change_requests) — kept in its own leaf module, depending on nothing but the raw models, so
// both of those services can require it without a require cycle (applicationTracking.service.js
// already requires changeRequests.service.js for other reasons; the reverse would be circular).
//
// One shared rank sequence across BOTH tables — an approved idea's track and an approved feature
// request's change request are, from the moment each is ready, competing for the exact same
// "what gets built next" queue (Idea Prioritization), so their ranks must never independently
// collide or interleave unpredictably.
const QUEUE_RANK_GAP = 1000;

/** Appends to the bottom of the shared ranked queue — one gap past whichever table's current max is higher, or the gap itself if both are empty. Runs inside the caller's own transaction. */
async function nextQueueRank(t) {
  const [trackMax, crMax] = await Promise.all([
    ApplicationTrack.max('queueRank', { transaction: t }),
    ChangeRequest.max('queueRank', { transaction: t }),
  ]);
  return Math.max(trackMax || 0, crMax || 0) + QUEUE_RANK_GAP;
}

/**
 * Renumbers the ENTIRE combined queue (both tables) to clean, evenly-spaced values — only ever
 * reached when a midpoint computation in reorderQueueItem() lands exactly on one of its two
 * neighbors (fractional precision exhausted, practically unreachable at this app's data volumes).
 * Runs inside the caller's own transaction.
 */
async function renumberQueue(t) {
  const [tracks, crs] = await Promise.all([
    ApplicationTrack.findAll({
      where: { queueRank: { [Op.ne]: null } }, attributes: ['id', 'queueRank'], transaction: t,
    }),
    ChangeRequest.findAll({
      where: { queueRank: { [Op.ne]: null } }, attributes: ['id', 'queueRank'], transaction: t,
    }),
  ]);
  const merged = [
    ...tracks.map((r) => ({ Model: ApplicationTrack, id: r.id, rank: r.queueRank })),
    ...crs.map((r) => ({ Model: ChangeRequest, id: r.id, rank: r.queueRank })),
  ].sort((a, b) => a.rank - b.rank);

  for (let i = 0; i < merged.length; i += 1) {
    const { Model, id } = merged[i];
    // eslint-disable-next-line no-await-in-loop
    await Model.update({ queueRank: (i + 1) * QUEUE_RANK_GAP }, { where: { id }, transaction: t });
  }
}

module.exports = { QUEUE_RANK_GAP, nextQueueRank, renumberQueue };

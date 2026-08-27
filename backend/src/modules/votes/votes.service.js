const { Vote, sequelize } = require('../../models');

async function toggle(userId, { entityType, entityId, voteType }) {
  const existing = await Vote.findOne({ where: { entityType, entityId, userId, voteType } });
  if (existing) {
    await existing.destroy();
    return { voted: false };
  }
  await Vote.create({ entityType, entityId, userId, voteType });
  return { voted: true };
}

async function summary(entityType, entityId, userId) {
  // Aggregate counts in SQL (GROUP BY) rather than pulling every vote row into Node just to
  // tally it in a loop — matters once a popular idea/suggestion has thousands of votes.
  const [countRows, userVoteRows] = await Promise.all([
    Vote.findAll({
      attributes: ['voteType', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      where: { entityType, entityId },
      group: ['voteType'],
      raw: true,
    }),
    Vote.findAll({
      attributes: ['voteType'],
      where: { entityType, entityId, userId },
      raw: true,
    }),
  ]);

  const counts = {};
  countRows.forEach((row) => { counts[row.voteType] = Number(row.count); });

  return { counts, userVotes: userVoteRows.map((v) => v.voteType) };
}

module.exports = { toggle, summary };

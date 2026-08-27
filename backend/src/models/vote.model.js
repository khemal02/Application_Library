module.exports = (sequelize, DataTypes) => {
  const Vote = sequelize.define('Vote', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    entityType: { type: DataTypes.STRING(60), allowNull: false },
    entityId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    voteType: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'upvote' },
  }, {
    tableName: 'votes',
    indexes: [
      { unique: true, fields: ['entity_type', 'entity_id', 'user_id', 'vote_type'] },
    ],
  });

  Vote.associate = (db) => {
    Vote.belongsTo(db.User, { foreignKey: 'userId', as: 'user' });
  };

  return Vote;
};

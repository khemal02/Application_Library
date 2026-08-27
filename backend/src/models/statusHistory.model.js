module.exports = (sequelize, DataTypes) => {
  const StatusHistory = sequelize.define('StatusHistory', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    entityType: { type: DataTypes.STRING(60), allowNull: false },
    entityId: { type: DataTypes.UUID, allowNull: false },
    fromStatus: { type: DataTypes.STRING(40) },
    toStatus: { type: DataTypes.STRING(40), allowNull: false },
    changedBy: { type: DataTypes.UUID, allowNull: true },
    note: { type: DataTypes.TEXT },
  }, {
    tableName: 'status_history',
    updatedAt: false,
    indexes: [{ fields: ['entity_type', 'entity_id'] }],
  });

  StatusHistory.associate = (db) => {
    StatusHistory.belongsTo(db.User, { foreignKey: 'changedBy', as: 'changedByUser' });
  };

  return StatusHistory;
};

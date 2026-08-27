module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: true },
    action: { type: DataTypes.STRING(20), allowNull: false },
    entityType: { type: DataTypes.STRING(60), allowNull: false },
    entityId: { type: DataTypes.UUID, allowNull: true },
    oldValue: { type: DataTypes.JSONB },
    newValue: { type: DataTypes.JSONB },
    ipAddress: { type: DataTypes.STRING(60) },
  }, {
    tableName: 'audit_logs',
    updatedAt: false,
    indexes: [{ fields: ['entity_type', 'entity_id'] }, { fields: ['user_id'] }],
  });

  AuditLog.associate = (db) => {
    AuditLog.belongsTo(db.User, { foreignKey: 'userId', as: 'user' });
  };

  return AuditLog;
};

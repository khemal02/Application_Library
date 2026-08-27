module.exports = (sequelize, DataTypes) => {
  const UserSession = sequelize.define('UserSession', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    jti: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    browser: { type: DataTypes.STRING(100) },
    os: { type: DataTypes.STRING(100) },
    device: { type: DataTypes.STRING(100) },
    ipAddress: { type: DataTypes.STRING(60) },
    lastActiveAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    revokedAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'user_sessions',
  });

  UserSession.associate = (db) => {
    UserSession.belongsTo(db.User, { foreignKey: 'userId', as: 'user' });
  };

  return UserSession;
};

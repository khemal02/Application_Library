module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define('Notification', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    type: { type: DataTypes.STRING(60), allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    message: { type: DataTypes.TEXT },
    link: { type: DataTypes.STRING(500) },
    isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  }, {
    tableName: 'notifications',
    indexes: [{ fields: ['user_id', 'is_read'] }],
  });

  Notification.associate = (db) => {
    Notification.belongsTo(db.User, { foreignKey: 'userId', as: 'user' });
  };

  return Notification;
};

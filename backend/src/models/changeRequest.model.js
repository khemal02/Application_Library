module.exports = (sequelize, DataTypes) => {
  const ChangeRequest = sequelize.define('ChangeRequest', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    applicationId: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.TEXT, allowNull: false },
    description: { type: DataTypes.TEXT },
    priority: { type: DataTypes.ENUM('low', 'medium', 'high', 'critical'), allowNull: false, defaultValue: 'medium' },
    status: { type: DataTypes.ENUM('pending', 'in_review', 'approved', 'rejected', 'implemented'), allowNull: false, defaultValue: 'pending' },
    requestedBy: { type: DataTypes.UUID, allowNull: true },
  }, {
    tableName: 'change_requests',
    indexes: [{ fields: ['application_id', 'status'] }],
  });

  ChangeRequest.associate = (db) => {
    ChangeRequest.belongsTo(db.Application, { foreignKey: 'applicationId', as: 'application' });
    ChangeRequest.belongsTo(db.User, { foreignKey: 'requestedBy', as: 'requester' });
  };

  return ChangeRequest;
};

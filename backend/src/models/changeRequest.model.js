module.exports = (sequelize, DataTypes) => {
  const ChangeRequest = sequelize.define('ChangeRequest', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    applicationId: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.TEXT, allowNull: false },
    description: { type: DataTypes.TEXT },
    priority: { type: DataTypes.ENUM('low', 'medium', 'high', 'critical'), allowNull: false, defaultValue: 'medium' },
    status: { type: DataTypes.ENUM('pending', 'in_review', 'approved', 'rejected', 'implemented'), allowNull: false, defaultValue: 'pending' },
    requestedBy: { type: DataTypes.UUID, allowNull: true },
    // Reserved for the (not-yet-built) Ideas -> change request bridge. Declared here only so
    // Sequelize doesn't silently drop it on a plain .update() — nothing writes to it and nothing
    // reads it yet.
    ideaId: { type: DataTypes.UUID, allowNull: true },
  }, {
    tableName: 'change_requests',
    indexes: [{ fields: ['application_id', 'status'] }],
  });

  ChangeRequest.associate = (db) => {
    ChangeRequest.belongsTo(db.Application, { foreignKey: 'applicationId', as: 'application' });
    ChangeRequest.belongsTo(db.User, { foreignKey: 'requestedBy', as: 'requester' });
    ChangeRequest.hasMany(db.ChangeRequestStage, { foreignKey: 'changeRequestId', as: 'stages' });
  };

  return ChangeRequest;
};

module.exports = (sequelize, DataTypes) => {
  const ChangeRequest = sequelize.define('ChangeRequest', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    applicationId: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.TEXT, allowNull: false },
    description: { type: DataTypes.TEXT },
    status: { type: DataTypes.ENUM('pending', 'in_review', 'approved', 'rejected', 'implemented'), allowNull: false, defaultValue: 'pending' },
    requestedBy: { type: DataTypes.UUID, allowNull: true },
    // Dead as of the Ideas/Feature-Requests split: only ever set by an approved
    // existing_app_feature IDEA, and that category no longer exists on the `ideas` table (it's
    // its own `feature_requests` table now — see featureRequestId below). Left declared, not
    // dropped, purely so a stray .update() never silently loses it; no code reads or writes it.
    ideaId: { type: DataTypes.UUID, allowNull: true },
    // Set only when this request came from an approved feature request — see
    // featureRequests.service.js#finalizeFeatureRequest and
    // changeRequests.service.js#createFromFeatureRequest. Null for anything raised directly.
    featureRequestId: { type: DataTypes.UUID, allowNull: true },
  }, {
    tableName: 'change_requests',
    indexes: [{ fields: ['application_id', 'status'] }],
  });

  ChangeRequest.associate = (db) => {
    ChangeRequest.belongsTo(db.Application, { foreignKey: 'applicationId', as: 'application' });
    ChangeRequest.belongsTo(db.User, { foreignKey: 'requestedBy', as: 'requester' });
    ChangeRequest.belongsTo(db.FeatureRequest, { foreignKey: 'featureRequestId', as: 'featureRequest' });
    ChangeRequest.hasMany(db.ChangeRequestStage, { foreignKey: 'changeRequestId', as: 'stages' });
  };

  return ChangeRequest;
};

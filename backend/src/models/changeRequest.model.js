module.exports = (sequelize, DataTypes) => {
  const ChangeRequest = sequelize.define('ChangeRequest', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    applicationId: { type: DataTypes.UUID, allowNull: false },
    // Nullable as of the feature-request bridge repair — a linked row (featureRequestId or
    // issueId set) carries NULL here and is read through the association instead; see
    // changeRequests.service.js#resolveSource. A CHECK constraint (change_requests_source_check)
    // enforces "title set OR some source set" at the DB level, not just here.
    title: { type: DataTypes.TEXT, allowNull: true },
    description: { type: DataTypes.TEXT },
    status: { type: DataTypes.ENUM('pending', 'in_review', 'approved', 'rejected', 'implemented'), allowNull: false, defaultValue: 'pending' },
    requestedBy: { type: DataTypes.UUID, allowNull: true },
    // Set only when this request came from an approved feature request — see
    // featureRequests.service.js#finalizeFeatureRequest and
    // changeRequests.service.js#createFromFeatureRequest. Null for anything raised directly.
    featureRequestId: { type: DataTypes.UUID, allowNull: true },
    // Set only when this request came from Issues' "Convert to change request" — see
    // issues.service.js#convert. A change request with this set is LOCKED: approved -> implemented
    // only, never rejectable, never deletable — enforced in this module's update()/remove().
    issueId: { type: DataTypes.UUID, allowNull: true },
    // Manual build-sequence rank, shared with application_tracks.queue_rank — see
    // 20260130000054-add-change-request-queue-rank.js. Non-null only for a feature-request-sourced
    // change request that's `approved` with Development still `not_started`; cleared the moment it
    // moves to build (changeRequests.service.js#moveToBuild). A directly-raised or issue-converted
    // change request never gets one — outside Idea Prioritization's scope, always NULL.
    queueRank: { type: DataTypes.DOUBLE, allowNull: true },
  }, {
    tableName: 'change_requests',
    indexes: [{ fields: ['application_id', 'status'] }],
  });

  ChangeRequest.associate = (db) => {
    ChangeRequest.belongsTo(db.Application, { foreignKey: 'applicationId', as: 'application' });
    ChangeRequest.belongsTo(db.User, { foreignKey: 'requestedBy', as: 'requester' });
    ChangeRequest.belongsTo(db.FeatureRequest, { foreignKey: 'featureRequestId', as: 'featureRequest' });
    ChangeRequest.belongsTo(db.Issue, { foreignKey: 'issueId', as: 'sourceIssue' });
    ChangeRequest.hasMany(db.ChangeRequestStage, { foreignKey: 'changeRequestId', as: 'stages' });
  };

  return ChangeRequest;
};

module.exports = (sequelize, DataTypes) => {
  const ApplicationTrack = sequelize.define('ApplicationTrack', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    ideaId: { type: DataTypes.UUID, allowNull: false, unique: true },
    // Nullable override — falls back to the idea's own title/description when unset. See
    // applicationTracking.service.js#resolveTrack.
    name: { type: DataTypes.STRING(200), allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    priority: {
      type: DataTypes.ENUM('critical', 'high', 'medium', 'low'), allowNull: false, defaultValue: 'medium',
    },
    // A lifecycle, not a duplicate of the stages — 'active' means "working through the stages, the
    // displayed chip is derived from them"; the other three override the derived chip. See
    // applicationTrackStatus.js (frontend) for the derivation.
    status: {
      type: DataTypes.ENUM('active', 'on_hold', 'live', 'cancelled'), allowNull: false, defaultValue: 'active',
    },
    ownerId: { type: DataTypes.UUID, allowNull: true },
    // Both optionally set at idea-approval time, alongside the owner picker — see
    // ideas.service.js#finalizeIdea. Neither is required; a track created without them just has
    // these unset, same as before this pair existed.
    startDate: { type: DataTypes.DATEONLY, allowNull: true },
    targetGoLive: { type: DataTypes.DATEONLY, allowNull: true },
    // Set only when the Deployment stage completes (go-live) — null for the entire life of the
    // track until then.
    applicationId: { type: DataTypes.UUID, allowNull: true },
    closureReason: { type: DataTypes.TEXT, allowNull: true },
    closedAt: { type: DataTypes.DATEONLY, allowNull: true },
  }, {
    tableName: 'application_tracks',
    indexes: [{ fields: ['status', 'priority'] }],
  });

  ApplicationTrack.associate = (db) => {
    ApplicationTrack.belongsTo(db.Idea, { foreignKey: 'ideaId', as: 'idea' });
    ApplicationTrack.belongsTo(db.User, { foreignKey: 'ownerId', as: 'owner' });
    ApplicationTrack.belongsTo(db.Application, { foreignKey: 'applicationId', as: 'application' });
    ApplicationTrack.hasMany(db.ApplicationTrackStage, { foreignKey: 'applicationTrackId', as: 'stages' });
  };

  return ApplicationTrack;
};

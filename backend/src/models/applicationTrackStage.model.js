module.exports = (sequelize, DataTypes) => {
  const ApplicationTrackStage = sequelize.define('ApplicationTrackStage', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    applicationTrackId: { type: DataTypes.UUID, allowNull: false },
    // Scoping was retired (see 20260130000046-remove-scoping-stage.js) — the Postgres enum type
    // still has the old value defined (can't be dropped, same constraint as every other retired
    // enum value in this codebase), but nothing here writes or expects it anymore.
    stage: {
      type: DataTypes.ENUM('development', 'testing', 'deployment'), allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('not_started', 'in_progress', 'complete'), allowNull: false, defaultValue: 'not_started',
    },
    assigneeId: { type: DataTypes.UUID, allowNull: true },
    startDate: { type: DataTypes.DATEONLY, allowNull: true },
    endDate: { type: DataTypes.DATEONLY, allowNull: true },
    // The actual completion date — set only by the server, only when status moves to 'complete'
    // (see applicationTracking.service.js#updateStage). Distinct from endDate ("Expected finish"),
    // which stays a manually-set target the owner controls and the server never overwrites.
    finishedDate: { type: DataTypes.DATEONLY, allowNull: true },
    // A link to an external document (spec, test report, deployment runbook, ...) — plain text, no
    // validation beyond the validator's Joi.string().uri(). Screenshots are NOT stored here; they go
    // through the generic Attachment model instead (entityType 'application_track_stage', entityId
    // this row's own id).
    documentUrl: { type: DataTypes.STRING(500), allowNull: true },
  }, {
    tableName: 'application_track_stages',
    indexes: [{ unique: true, fields: ['application_track_id', 'stage'] }],
  });

  ApplicationTrackStage.associate = (db) => {
    ApplicationTrackStage.belongsTo(db.ApplicationTrack, { foreignKey: 'applicationTrackId', as: 'applicationTrack' });
    ApplicationTrackStage.belongsTo(db.User, { foreignKey: 'assigneeId', as: 'assignee' });
  };

  return ApplicationTrackStage;
};

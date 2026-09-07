module.exports = (sequelize, DataTypes) => {
  const ApplicationTrackStage = sequelize.define('ApplicationTrackStage', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    applicationTrackId: { type: DataTypes.UUID, allowNull: false },
    stage: {
      type: DataTypes.ENUM('scoping', 'development', 'testing', 'deployment'), allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('not_started', 'in_progress', 'complete'), allowNull: false, defaultValue: 'not_started',
    },
    assigneeId: { type: DataTypes.UUID, allowNull: true },
    startDate: { type: DataTypes.DATEONLY, allowNull: true },
    endDate: { type: DataTypes.DATEONLY, allowNull: true },
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

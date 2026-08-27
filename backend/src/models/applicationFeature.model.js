module.exports = (sequelize, DataTypes) => {
  const ApplicationFeature = sequelize.define('ApplicationFeature', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    applicationId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT },
    status: {
      type: DataTypes.ENUM('planned', 'in_progress', 'completed', 'blocked'),
      allowNull: false,
      defaultValue: 'planned',
    },
    assignedDeveloperId: { type: DataTypes.UUID, allowNull: true },
    estimatedTime: { type: DataTypes.STRING(60) },
    completionDate: { type: DataTypes.DATEONLY },
  }, {
    tableName: 'application_features',
    indexes: [{ fields: ['application_id', 'status'] }],
  });

  ApplicationFeature.associate = (db) => {
    ApplicationFeature.belongsTo(db.Application, { foreignKey: 'applicationId', as: 'application' });
    ApplicationFeature.belongsTo(db.User, { foreignKey: 'assignedDeveloperId', as: 'assignedDeveloper' });
    ApplicationFeature.hasMany(db.FeatureDependency, { foreignKey: 'featureId', as: 'dependencies' });
  };

  return ApplicationFeature;
};

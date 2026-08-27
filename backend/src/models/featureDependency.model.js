module.exports = (sequelize, DataTypes) => {
  const FeatureDependency = sequelize.define('FeatureDependency', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    featureId: { type: DataTypes.UUID, allowNull: false },
    dependsOnFeatureId: { type: DataTypes.UUID, allowNull: false },
  }, {
    tableName: 'feature_dependencies',
    updatedAt: false,
    indexes: [{ unique: true, fields: ['feature_id', 'depends_on_feature_id'] }],
  });

  FeatureDependency.associate = (db) => {
    FeatureDependency.belongsTo(db.ApplicationFeature, { foreignKey: 'featureId', as: 'feature' });
    FeatureDependency.belongsTo(db.ApplicationFeature, { foreignKey: 'dependsOnFeatureId', as: 'dependsOn' });
  };

  return FeatureDependency;
};

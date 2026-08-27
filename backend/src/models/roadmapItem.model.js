module.exports = (sequelize, DataTypes) => {
  const RoadmapItem = sequelize.define('RoadmapItem', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    applicationId: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT },
    targetQuarter: { type: DataTypes.STRING(20) },
    status: { type: DataTypes.ENUM('proposed', 'planned', 'in_progress', 'done'), allowNull: false, defaultValue: 'proposed' },
    priority: { type: DataTypes.ENUM('low', 'medium', 'high', 'critical'), allowNull: false, defaultValue: 'medium' },
  }, {
    tableName: 'roadmap_items',
    indexes: [{ fields: ['application_id', 'status'] }],
  });

  RoadmapItem.associate = (db) => {
    RoadmapItem.belongsTo(db.Application, { foreignKey: 'applicationId', as: 'application' });
  };

  return RoadmapItem;
};

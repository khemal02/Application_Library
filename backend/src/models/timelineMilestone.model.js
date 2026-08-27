module.exports = (sequelize, DataTypes) => {
  const TimelineMilestone = sequelize.define('TimelineMilestone', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    applicationId: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT },
    dueDate: { type: DataTypes.DATEONLY },
    status: { type: DataTypes.ENUM('upcoming', 'in_progress', 'completed', 'delayed'), allowNull: false, defaultValue: 'upcoming' },
  }, {
    tableName: 'timeline_milestones',
    indexes: [{ fields: ['application_id', 'status'] }],
  });

  TimelineMilestone.associate = (db) => {
    TimelineMilestone.belongsTo(db.Application, { foreignKey: 'applicationId', as: 'application' });
  };

  return TimelineMilestone;
};

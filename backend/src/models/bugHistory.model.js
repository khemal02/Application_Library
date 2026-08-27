module.exports = (sequelize, DataTypes) => {
  const BugHistory = sequelize.define('BugHistory', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    applicationId: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT },
    severity: { type: DataTypes.ENUM('low', 'medium', 'high', 'critical'), allowNull: false, defaultValue: 'medium' },
    status: { type: DataTypes.ENUM('open', 'in_progress', 'resolved', 'wont_fix'), allowNull: false, defaultValue: 'open' },
    reportedBy: { type: DataTypes.UUID, allowNull: true },
    resolvedBy: { type: DataTypes.UUID, allowNull: true },
    reportedDate: { type: DataTypes.DATEONLY },
    resolvedDate: { type: DataTypes.DATEONLY },
  }, {
    tableName: 'bug_history',
    indexes: [{ fields: ['application_id', 'status'] }],
  });

  BugHistory.associate = (db) => {
    BugHistory.belongsTo(db.Application, { foreignKey: 'applicationId', as: 'application' });
    BugHistory.belongsTo(db.User, { foreignKey: 'reportedBy', as: 'reporter' });
    BugHistory.belongsTo(db.User, { foreignKey: 'resolvedBy', as: 'resolver' });
  };

  return BugHistory;
};

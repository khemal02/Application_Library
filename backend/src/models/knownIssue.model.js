module.exports = (sequelize, DataTypes) => {
  const KnownIssue = sequelize.define('KnownIssue', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    applicationId: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT },
    severity: { type: DataTypes.ENUM('low', 'medium', 'high', 'critical'), allowNull: false, defaultValue: 'medium' },
    status: { type: DataTypes.ENUM('active', 'monitoring', 'resolved'), allowNull: false, defaultValue: 'active' },
    workaround: { type: DataTypes.TEXT },
  }, {
    tableName: 'known_issues',
    indexes: [{ fields: ['application_id', 'status'] }],
  });

  KnownIssue.associate = (db) => {
    KnownIssue.belongsTo(db.Application, { foreignKey: 'applicationId', as: 'application' });
  };

  return KnownIssue;
};

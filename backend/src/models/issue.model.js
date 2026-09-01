module.exports = (sequelize, DataTypes) => {
  const Issue = sequelize.define('Issue', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    applicationId: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT },
    severity: { type: DataTypes.ENUM('low', 'medium', 'high', 'critical'), allowNull: false },
    status: {
      type: DataTypes.ENUM(
        'needs_triage', 'acknowledged', 'being_fixed', 'resolved',
        'known_limitation', 'duplicate', 'not_an_issue',
      ),
      allowNull: false,
      defaultValue: 'needs_triage',
    },
    reportedBy: { type: DataTypes.UUID, allowNull: false },
    assigneeId: { type: DataTypes.UUID, allowNull: true },
    affectedVersion: { type: DataTypes.STRING(50) },
    duplicateOfId: { type: DataTypes.UUID, allowNull: true },
    closureNote: { type: DataTypes.TEXT },
    closedAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'issues',
    indexes: [{ fields: ['application_id', 'status'] }],
  });

  Issue.associate = (db) => {
    Issue.belongsTo(db.Application, { foreignKey: 'applicationId', as: 'application' });
    Issue.belongsTo(db.User, { foreignKey: 'reportedBy', as: 'reporter' });
    Issue.belongsTo(db.User, { foreignKey: 'assigneeId', as: 'assignee' });
    Issue.belongsTo(db.Issue, { foreignKey: 'duplicateOfId', as: 'duplicateOf' });
    // Reverse side of ChangeRequest.sourceIssue — set only via issues.service.js#convert.
    Issue.hasOne(db.ChangeRequest, { foreignKey: 'issueId', as: 'changeRequest' });
  };

  return Issue;
};

// One row per (change request, stage) — the three always exist together (seeded as a set, see
// 20260130000033-change-request-stages-and-title-fix.js), never created/removed individually.
// All transition rules live in changeRequests.service.js#updateStage, not here.
module.exports = (sequelize, DataTypes) => {
  const ChangeRequestStage = sequelize.define('ChangeRequestStage', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    changeRequestId: { type: DataTypes.UUID, allowNull: false },
    stage: { type: DataTypes.ENUM('development', 'testing', 'deployment'), allowNull: false },
    status: { type: DataTypes.ENUM('not_started', 'in_progress', 'complete'), allowNull: false, defaultValue: 'not_started' },
    assigneeId: { type: DataTypes.UUID, allowNull: true },
    startDate: { type: DataTypes.DATEONLY, allowNull: true },
    endDate: { type: DataTypes.DATEONLY, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
  }, {
    tableName: 'change_request_stages',
    indexes: [{ unique: true, fields: ['change_request_id', 'stage'] }],
  });

  ChangeRequestStage.associate = (db) => {
    ChangeRequestStage.belongsTo(db.ChangeRequest, { foreignKey: 'changeRequestId', as: 'changeRequest' });
    ChangeRequestStage.belongsTo(db.User, { foreignKey: 'assigneeId', as: 'assignee' });
  };

  return ChangeRequestStage;
};

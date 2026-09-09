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
    // A link to an external document (spec, test report, deployment runbook, ...) — plain text, no
    // validation beyond the validator's Joi.string().uri(). Screenshots are NOT stored here; they go
    // through the generic Attachment model instead (entityType 'change_request_stage', entityId
    // this row's own id).
    documentUrl: { type: DataTypes.STRING(500), allowNull: true },
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

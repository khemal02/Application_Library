// The review panel for a feature request — identical shape to idea_reviews (see that model's own
// comments for the rules this backs: one row per person per request, majority-vote approvers,
// advisory reviewers, tie-break via a synthetic 'tiebreaker' kind row), minus idea_reviews' legacy
// reviewer_id/role_name columns, which only ever existed to backfill the old ideas review chain —
// nothing analogous applies here since this table only ever existed under the new panel model.
module.exports = (sequelize, DataTypes) => {
  const FeatureRequestReview = sequelize.define('FeatureRequestReview', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    featureRequestId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    // 'reviewer' | 'approver' | 'tiebreaker' — see featureRequests.constants.js#PANEL_KINDS.
    kind: { type: DataTypes.STRING(20), allowNull: false },
    addedBy: { type: DataTypes.UUID, allowNull: true },
    addedAt: { type: DataTypes.DATE, allowNull: true },
    decision: { type: DataTypes.ENUM('approve', 'request_changes', 'reject'), allowNull: true },
    note: { type: DataTypes.TEXT },
  }, {
    tableName: 'feature_request_reviews',
    indexes: [{ fields: ['feature_request_id'] }],
  });

  FeatureRequestReview.associate = (db) => {
    FeatureRequestReview.belongsTo(db.FeatureRequest, { foreignKey: 'featureRequestId', as: 'featureRequest' });
    FeatureRequestReview.belongsTo(db.User, { foreignKey: 'userId', as: 'user' });
    FeatureRequestReview.belongsTo(db.User, { foreignKey: 'addedBy', as: 'addedByUser' });
  };

  return FeatureRequestReview;
};

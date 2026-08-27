module.exports = (sequelize, DataTypes) => {
  const SuggestionReview = sequelize.define('SuggestionReview', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    suggestionId: { type: DataTypes.UUID, allowNull: false },
    reviewerId: { type: DataTypes.UUID, allowNull: true },
    // Snapshot of which slot this verdict filled — independent of the reviewer's CURRENT role, so a
    // later role change can't silently move an old verdict to a different slot.
    roleName: { type: DataTypes.STRING(40), allowNull: false },
    decision: { type: DataTypes.ENUM('approve', 'request_changes', 'reject'), allowNull: false },
    note: { type: DataTypes.TEXT },
  }, {
    tableName: 'suggestion_reviews',
    indexes: [{ fields: ['suggestion_id'] }],
  });

  SuggestionReview.associate = (db) => {
    SuggestionReview.belongsTo(db.ApplicationSuggestion, { foreignKey: 'suggestionId', as: 'suggestion' });
    SuggestionReview.belongsTo(db.User, { foreignKey: 'reviewerId', as: 'reviewer' });
  };

  return SuggestionReview;
};

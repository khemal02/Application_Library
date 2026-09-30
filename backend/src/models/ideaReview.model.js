module.exports = (sequelize, DataTypes) => {
  const IdeaReview = sequelize.define('IdeaReview', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    ideaId: { type: DataTypes.UUID, allowNull: false },
    // One row per PERSON per idea now (UNIQUE(idea_id, user_id)) — not one row per role slot.
    userId: { type: DataTypes.UUID, allowNull: false },
    // 'reviewer' | 'approver' — see ideas.constants.js#PANEL_KINDS. Reviewers give an advisory
    // verdict that never moves the idea; approvers decide it (all must approve; any one reject
    // ends it immediately).
    kind: { type: DataTypes.STRING(20), allowNull: false },
    // Who added this person to the panel, and when — null for the 7 legacy rows (backfilled from
    // the old chain, nobody "added" them in the new sense) and for any row a future data
    // migration might seed directly.
    addedBy: { type: DataTypes.UUID, allowNull: true },
    addedAt: { type: DataTypes.DATE, allowNull: true },
    // null until this person records a verdict.
    decision: { type: DataTypes.ENUM('approve', 'request_changes', 'reject'), allowNull: true },
    note: { type: DataTypes.TEXT },
  }, {
    tableName: 'idea_reviews',
    indexes: [{ fields: ['idea_id'] }],
  });

  IdeaReview.associate = (db) => {
    IdeaReview.belongsTo(db.Idea, { foreignKey: 'ideaId', as: 'idea' });
    IdeaReview.belongsTo(db.User, { foreignKey: 'userId', as: 'user' });
    IdeaReview.belongsTo(db.User, { foreignKey: 'addedBy', as: 'addedByUser' });
  };

  return IdeaReview;
};

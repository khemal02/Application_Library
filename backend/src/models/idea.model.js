module.exports = (sequelize, DataTypes) => {
  const Idea = sequelize.define('Idea', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    // Human-friendly sequential number ("Idea #12") — DB-generated via a sequence, never set by
    // the app. The UUID `id` above stays the real identity/FK target everywhere else.
    ideaNumber: { type: DataTypes.INTEGER, allowNull: false, autoIncrement: true },
    title: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false },
    industry: { type: DataTypes.STRING(60), allowNull: true },
    functionalArea: { type: DataTypes.STRING(60), allowNull: true },
    internalUse: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // 'existing_app_feature' ideas are tied to a specific Application via applicationId — the
    // "New Features to Existing Application" list is just this table filtered to that category.
    category: {
      type: DataTypes.ENUM('new_idea', 'existing_app_feature'),
      allowNull: false,
      defaultValue: 'new_idea',
    },
    applicationId: { type: DataTypes.UUID, allowNull: true },
    businessProblem: { type: DataTypes.TEXT },
    proposedSolution: { type: DataTypes.TEXT },
    expectedBenefits: { type: DataTypes.TEXT },
    aiUsage: { type: DataTypes.TEXT },
    technologySuggestion: { type: DataTypes.TEXT },
    technologiesAndEfficiency: { type: DataTypes.TEXT },
    departmentId: { type: DataTypes.UUID, allowNull: true },
    targetUsers: { type: DataTypes.STRING(300) },
    estimatedComplexity: { type: DataTypes.ENUM('low', 'medium', 'high'), defaultValue: 'medium' },
    estimatedDevTime: { type: DataTypes.STRING(60) },
    // submitted/technical_review_1/technical_review_2/review/discussion/development_ready are all
    // retired now (discussion and development_ready by this phase — discussion is no longer a live
    // gate, ideas are created directly at under_review; development_ready is folded into approved)
    // but stay listed — Postgres is the real enforcement point for this column (confirmed
    // empirically: an invalid value throws SequelizeDatabaseError from the DB, not a client-side
    // Sequelize validation error, so this array isn't actually load-bearing), and old rows may
    // still hold any of them.
    status: {
      type: DataTypes.ENUM('submitted', 'discussion', 'technical_review_1', 'technical_review_2', 'review', 'under_review', 'approved', 'rejected', 'development_ready'),
      allowNull: false,
      defaultValue: 'under_review',
    },
    priority: { type: DataTypes.ENUM('low', 'medium', 'high', 'critical'), allowNull: false, defaultValue: 'medium' },
    submittedBy: { type: DataTypes.UUID, allowNull: false },
    // Unused as of the strict-chain phase — the single-reviewer-claim model this backed
    // (assignReviewer(), PATCH /ideas/:id/reviewer) was deleted along with the rest of the old
    // stage machine. Left as a column rather than dropped: dropping it needs its own migration
    // and buys nothing, since nothing reads or writes it anymore.
    reviewerId: { type: DataTypes.UUID, allowNull: true },
    reviewNotes: { type: DataTypes.TEXT },
    reviewerFeedback: { type: DataTypes.TEXT },
    searchVector: { type: DataTypes.TSVECTOR },
  }, {
    tableName: 'ideas',
    indexes: [
      { fields: ['status'] },
      { fields: ['submitted_by'] },
      { using: 'GIN', fields: ['search_vector'] },
    ],
    hooks: {
      beforeSave: (instance) => {
        if (instance.changed('title') || instance.changed('description') || instance.isNewRecord) {
          instance.searchVector = sequelize.fn(
            'to_tsvector', 'english', [instance.title, instance.description].filter(Boolean).join(' '),
          );
        }
      },
    },
  });

  Idea.associate = (db) => {
    Idea.belongsTo(db.Department, { foreignKey: 'departmentId', as: 'department' });
    Idea.belongsTo(db.Application, { foreignKey: 'applicationId', as: 'application' });
    Idea.belongsTo(db.User, { foreignKey: 'submittedBy', as: 'submitter' });
    Idea.belongsTo(db.User, { foreignKey: 'reviewerId', as: 'reviewer' });
    Idea.hasMany(db.IdeaReview, { foreignKey: 'ideaId', as: 'reviews' });
  };

  return Idea;
};

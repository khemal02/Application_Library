// "Modify Current Application" — split out of `ideas` (see 20260130000035) into its own table so
// the two modules are genuinely independent, not one table wearing two list-page skins. Always
// tied to an EXISTING Application (applicationId is required, unlike Idea's optional one) — a
// feature request never registers a new Application the way an approved new_idea can.
module.exports = (sequelize, DataTypes) => {
  const FeatureRequest = sequelize.define('FeatureRequest', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    // Human-friendly sequential number ("Feature Request #12") — DB-generated via its own
    // sequence, separate from ideas_idea_number_seq. The UUID `id` stays the real identity/FK
    // target everywhere else.
    requestNumber: { type: DataTypes.INTEGER, allowNull: false, autoIncrement: true },
    title: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false },
    industry: { type: DataTypes.STRING(60), allowNull: true },
    functionalArea: { type: DataTypes.STRING(60), allowNull: true },
    internalUse: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    applicationId: { type: DataTypes.UUID, allowNull: false },
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
    // Only the 3 LIVE values — unlike ideas.status, this table never carried the retired
    // submitted/discussion/technical_review_1/2/review/development_ready values, so there's
    // nothing historical to keep the enum wide for.
    status: {
      type: DataTypes.ENUM('under_review', 'approved', 'rejected'), allowNull: false, defaultValue: 'under_review',
    },
    priority: { type: DataTypes.ENUM('low', 'medium', 'high', 'critical'), allowNull: false, defaultValue: 'medium' },
    submittedBy: { type: DataTypes.UUID, allowNull: false },
    searchVector: { type: DataTypes.TSVECTOR },
  }, {
    tableName: 'feature_requests',
    indexes: [
      { fields: ['status'] },
      { fields: ['submitted_by'] },
      { fields: ['application_id'] },
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

  FeatureRequest.associate = (db) => {
    FeatureRequest.belongsTo(db.Department, { foreignKey: 'departmentId', as: 'department' });
    FeatureRequest.belongsTo(db.Application, { foreignKey: 'applicationId', as: 'application' });
    FeatureRequest.belongsTo(db.User, { foreignKey: 'submittedBy', as: 'submitter' });
    FeatureRequest.hasMany(db.FeatureRequestReview, { foreignKey: 'featureRequestId', as: 'reviews' });
    // Set once approved — see featureRequests.service.js#finalizeFeatureRequest and
    // changeRequests.service.js#createFromFeatureRequest.
    FeatureRequest.hasOne(db.ChangeRequest, { foreignKey: 'featureRequestId', as: 'changeRequest' });
  };

  return FeatureRequest;
};

module.exports = (sequelize, DataTypes) => {
  const ApplicationSuggestion = sequelize.define('ApplicationSuggestion', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    applicationId: { type: DataTypes.UUID, allowNull: false },
    departmentId: { type: DataTypes.UUID, allowNull: true },
    // Second routing signal for the review panel, alongside departmentId — see
    // utils/reviewPanel.js#eligibleReviewers. Auto-filled from the linked Application, same as
    // departmentId.
    functionalArea: { type: DataTypes.STRING(60), allowNull: true },
    title: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false },
    currentProblem: { type: DataTypes.TEXT },
    suggestedSolution: { type: DataTypes.TEXT },
    expectedBenefit: { type: DataTypes.TEXT },
    priority: { type: DataTypes.ENUM('low', 'medium', 'high', 'critical'), allowNull: false, defaultValue: 'medium' },
    module: { type: DataTypes.STRING(120) },
    status: {
      type: DataTypes.ENUM(
        'submitted', 'technical_review', 'discussion', 'approved', 'assigned', 'implemented', 'closed', 'rejected',
      ),
      allowNull: false,
      defaultValue: 'submitted',
    },
    assignedTo: { type: DataTypes.UUID, allowNull: true },
    submittedBy: { type: DataTypes.UUID, allowNull: false },
    searchVector: { type: DataTypes.TSVECTOR },
  }, {
    tableName: 'application_suggestions',
    indexes: [
      { fields: ['application_id', 'status'] },
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

  ApplicationSuggestion.associate = (db) => {
    ApplicationSuggestion.belongsTo(db.Application, { foreignKey: 'applicationId', as: 'application' });
    ApplicationSuggestion.belongsTo(db.Department, { foreignKey: 'departmentId', as: 'department' });
    ApplicationSuggestion.belongsTo(db.User, { foreignKey: 'submittedBy', as: 'submitter' });
    ApplicationSuggestion.belongsTo(db.User, { foreignKey: 'assignedTo', as: 'assignee' });
    ApplicationSuggestion.hasMany(db.SuggestionReview, { foreignKey: 'suggestionId', as: 'reviews' });
  };

  return ApplicationSuggestion;
};

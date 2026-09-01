module.exports = (sequelize, DataTypes) => {
  const Application = sequelize.define('Application', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT },
    category: { type: DataTypes.STRING(80) },
    industry: { type: DataTypes.STRING(60), allowNull: true },
    functionalArea: { type: DataTypes.STRING(60), allowNull: true },
    ownerId: { type: DataTypes.UUID, allowNull: true },
    departmentId: { type: DataTypes.UUID, allowNull: true },
    status: {
      type: DataTypes.ENUM('development', 'testing', 'deployment'),
      allowNull: false,
      defaultValue: 'development',
    },
    startDate: { type: DataTypes.DATEONLY },
    releaseDate: { type: DataTypes.DATEONLY },
    currentVersion: { type: DataTypes.STRING(30) },
    repositoryUrl: { type: DataTypes.STRING(500) },
    deploymentUrl: { type: DataTypes.STRING(500) },
    createdBy: { type: DataTypes.UUID, allowNull: true },
    searchVector: { type: DataTypes.TSVECTOR },
  }, {
    tableName: 'applications',
    indexes: [
      { fields: ['status'] },
      { fields: ['category'] },
      { fields: ['owner_id'] },
      { using: 'GIN', fields: ['search_vector'] },
    ],
    hooks: {
      beforeSave: (instance) => {
        if (instance.changed('name') || instance.changed('description') || instance.isNewRecord) {
          instance.searchVector = sequelize.fn(
            'to_tsvector', 'english', [instance.name, instance.description].filter(Boolean).join(' '),
          );
        }
      },
    },
  });

  Application.associate = (db) => {
    Application.belongsTo(db.User, { foreignKey: 'ownerId', as: 'owner' });
    Application.belongsTo(db.Department, { foreignKey: 'departmentId', as: 'department' });
    Application.belongsTo(db.User, { foreignKey: 'createdBy', as: 'creator' });

    Application.hasMany(db.ApplicationTechStack, { foreignKey: 'applicationId', as: 'techStack' });
    Application.hasMany(db.ApplicationFeature, { foreignKey: 'applicationId', as: 'features' });
    Application.hasMany(db.AiPrompt, { foreignKey: 'applicationId', as: 'aiPrompts' });
    Application.hasMany(db.ArchitectureDoc, { foreignKey: 'applicationId', as: 'architectureDocs' });
    Application.hasMany(db.ApiEndpoint, { foreignKey: 'applicationId', as: 'apiEndpoints' });
    Application.hasMany(db.DbTableDoc, { foreignKey: 'applicationId', as: 'dbTableDocs' });
    Application.hasMany(db.ReleaseNote, { foreignKey: 'applicationId', as: 'releaseNotes' });
    Application.hasMany(db.BugHistory, { foreignKey: 'applicationId', as: 'bugs' });
    Application.hasMany(db.KnownIssue, { foreignKey: 'applicationId', as: 'knownIssues' });
    Application.hasMany(db.RoadmapItem, { foreignKey: 'applicationId', as: 'roadmapItems' });
    Application.hasMany(db.TimelineMilestone, { foreignKey: 'applicationId', as: 'timelineMilestones' });
    Application.hasMany(db.ApplicationSuggestion, { foreignKey: 'applicationId', as: 'suggestions' });
  };

  return Application;
};

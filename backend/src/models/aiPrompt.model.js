module.exports = (sequelize, DataTypes) => {
  const AiPrompt = sequelize.define('AiPrompt', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    applicationId: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    promptText: { type: DataTypes.TEXT, allowNull: false },
    promptType: { type: DataTypes.STRING(60) },
    aiModel: { type: DataTypes.STRING(80) },
    outputSummary: { type: DataTypes.TEXT },
    version: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'v1' },
    createdBy: { type: DataTypes.UUID, allowNull: true },
    searchVector: { type: DataTypes.TSVECTOR },
  }, {
    tableName: 'ai_prompts',
    indexes: [{ fields: ['application_id'] }, { using: 'GIN', fields: ['search_vector'] }],
    hooks: {
      beforeSave: (instance) => {
        if (instance.changed('title') || instance.changed('promptText') || instance.isNewRecord) {
          instance.searchVector = sequelize.fn(
            'to_tsvector', 'english', [instance.title, instance.promptText].filter(Boolean).join(' '),
          );
        }
      },
    },
  });

  AiPrompt.associate = (db) => {
    AiPrompt.belongsTo(db.Application, { foreignKey: 'applicationId', as: 'application' });
    AiPrompt.belongsTo(db.User, { foreignKey: 'createdBy', as: 'author' });
  };

  return AiPrompt;
};

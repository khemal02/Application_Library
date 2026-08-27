module.exports = (sequelize, DataTypes) => {
  const ApplicationTechStack = sequelize.define('ApplicationTechStack', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    applicationId: { type: DataTypes.UUID, allowNull: false },
    category: {
      type: DataTypes.ENUM('frontend', 'backend', 'database', 'ai_model', 'framework', 'library', 'cloud', 'devops'),
      allowNull: false,
    },
    name: { type: DataTypes.STRING(120), allowNull: false },
    version: { type: DataTypes.STRING(40) },
    notes: { type: DataTypes.TEXT },
  }, {
    tableName: 'application_tech_stack',
    indexes: [{ fields: ['application_id', 'category'] }],
  });

  ApplicationTechStack.associate = (db) => {
    ApplicationTechStack.belongsTo(db.Application, { foreignKey: 'applicationId', as: 'application' });
  };

  return ApplicationTechStack;
};

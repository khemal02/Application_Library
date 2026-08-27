module.exports = (sequelize, DataTypes) => {
  const ArchitectureDoc = sequelize.define('ArchitectureDoc', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    applicationId: { type: DataTypes.UUID, allowNull: false },
    docType: {
      type: DataTypes.ENUM(
        'high_level', 'folder_structure', 'api_flow', 'db_design',
        'auth_flow', 'microservice_diagram', 'deployment_diagram',
      ),
      allowNull: false,
    },
    title: { type: DataTypes.STRING(200) },
    contentMarkdown: { type: DataTypes.TEXT },
    diagramUrl: { type: DataTypes.STRING(500) },
    updatedBy: { type: DataTypes.UUID, allowNull: true },
  }, {
    tableName: 'architecture_docs',
    indexes: [{ unique: true, fields: ['application_id', 'doc_type'] }],
  });

  ArchitectureDoc.associate = (db) => {
    ArchitectureDoc.belongsTo(db.Application, { foreignKey: 'applicationId', as: 'application' });
    ArchitectureDoc.belongsTo(db.User, { foreignKey: 'updatedBy', as: 'updater' });
  };

  return ArchitectureDoc;
};

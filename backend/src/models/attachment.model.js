module.exports = (sequelize, DataTypes) => {
  const Attachment = sequelize.define('Attachment', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    entityType: { type: DataTypes.STRING(60), allowNull: false },
    entityId: { type: DataTypes.UUID, allowNull: false },
    fileName: { type: DataTypes.STRING(255), allowNull: false },
    filePath: { type: DataTypes.STRING(500), allowNull: false },
    fileSize: { type: DataTypes.INTEGER },
    mimeType: { type: DataTypes.STRING(120) },
    uploadedBy: { type: DataTypes.UUID, allowNull: true },
  }, {
    tableName: 'attachments',
    indexes: [{ fields: ['entity_type', 'entity_id'] }],
  });

  Attachment.associate = (db) => {
    Attachment.belongsTo(db.User, { foreignKey: 'uploadedBy', as: 'uploader' });
  };

  return Attachment;
};

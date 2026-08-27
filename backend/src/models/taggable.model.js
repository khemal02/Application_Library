module.exports = (sequelize, DataTypes) => {
  const Taggable = sequelize.define('Taggable', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tagId: { type: DataTypes.UUID, allowNull: false },
    entityType: { type: DataTypes.STRING(60), allowNull: false },
    entityId: { type: DataTypes.UUID, allowNull: false },
  }, {
    tableName: 'taggables',
    updatedAt: false,
    indexes: [
      { unique: true, fields: ['tag_id', 'entity_type', 'entity_id'] },
      { fields: ['entity_type', 'entity_id'] },
    ],
  });

  Taggable.associate = (db) => {
    Taggable.belongsTo(db.Tag, { foreignKey: 'tagId', as: 'tag' });
  };

  return Taggable;
};

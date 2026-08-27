module.exports = (sequelize, DataTypes) => {
  const Tag = sequelize.define('Tag', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(60), allowNull: false, unique: true },
  }, { tableName: 'tags' });

  Tag.associate = (db) => {
    Tag.hasMany(db.Taggable, { foreignKey: 'tagId', as: 'taggables' });
  };

  return Tag;
};

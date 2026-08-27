module.exports = (sequelize, DataTypes) => {
  const Comment = sequelize.define('Comment', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    entityType: { type: DataTypes.STRING(60), allowNull: false },
    entityId: { type: DataTypes.UUID, allowNull: false },
    parentCommentId: { type: DataTypes.UUID, allowNull: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
  }, {
    tableName: 'comments',
    indexes: [{ fields: ['entity_type', 'entity_id'] }, { fields: ['parent_comment_id'] }],
  });

  Comment.associate = (db) => {
    Comment.belongsTo(db.User, { foreignKey: 'userId', as: 'author' });
    Comment.belongsTo(db.Comment, { foreignKey: 'parentCommentId', as: 'parent' });
    Comment.hasMany(db.Comment, { foreignKey: 'parentCommentId', as: 'replies' });
  };

  return Comment;
};

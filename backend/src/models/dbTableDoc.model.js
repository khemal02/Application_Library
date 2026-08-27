module.exports = (sequelize, DataTypes) => {
  const DbTableDoc = sequelize.define('DbTableDoc', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    applicationId: { type: DataTypes.UUID, allowNull: false },
    // Named docTableName (DB column stays `table_name`) because `tableName` would collide with
    // Sequelize's own Model.tableName static property — do not "simplify" this back to tableName.
    docTableName: { type: DataTypes.STRING(120), allowNull: false, field: 'table_name' },
    description: { type: DataTypes.TEXT },
    columns: { type: DataTypes.JSONB },
    relationships: { type: DataTypes.JSONB },
    constraints: { type: DataTypes.JSONB },
  }, {
    tableName: 'db_table_docs',
    indexes: [{ fields: ['application_id'] }],
  });

  DbTableDoc.associate = (db) => {
    DbTableDoc.belongsTo(db.Application, { foreignKey: 'applicationId', as: 'application' });
  };

  return DbTableDoc;
};

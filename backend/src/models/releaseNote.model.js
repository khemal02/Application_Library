module.exports = (sequelize, DataTypes) => {
  const ReleaseNote = sequelize.define('ReleaseNote', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    applicationId: { type: DataTypes.UUID, allowNull: false },
    version: { type: DataTypes.STRING(30), allowNull: false },
    releaseDate: { type: DataTypes.DATEONLY },
    newFeatures: { type: DataTypes.ARRAY(DataTypes.TEXT), defaultValue: [] },
    bugFixes: { type: DataTypes.ARRAY(DataTypes.TEXT), defaultValue: [] },
    breakingChanges: { type: DataTypes.ARRAY(DataTypes.TEXT), defaultValue: [] },
    createdBy: { type: DataTypes.UUID, allowNull: true },
  }, {
    tableName: 'release_notes',
    indexes: [{ unique: true, fields: ['application_id', 'version'] }],
  });

  ReleaseNote.associate = (db) => {
    ReleaseNote.belongsTo(db.Application, { foreignKey: 'applicationId', as: 'application' });
    ReleaseNote.belongsTo(db.User, { foreignKey: 'createdBy', as: 'author' });
  };

  return ReleaseNote;
};

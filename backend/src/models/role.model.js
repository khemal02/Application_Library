module.exports = (sequelize, DataTypes) => {
  const Role = sequelize.define('Role', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    label: { type: DataTypes.STRING(100), allowNull: false },
    description: { type: DataTypes.TEXT },
  }, { tableName: 'roles' });

  Role.associate = (db) => {
    Role.hasMany(db.User, { foreignKey: 'roleId', as: 'users' });
    Role.hasMany(db.RolePermission, { foreignKey: 'roleId', as: 'permissions' });
  };

  return Role;
};

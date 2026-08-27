module.exports = (sequelize, DataTypes) => {
  const RolePermission = sequelize.define('RolePermission', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    roleId: { type: DataTypes.UUID, allowNull: false },
    resource: { type: DataTypes.STRING(60), allowNull: false },
    action: { type: DataTypes.STRING(20), allowNull: false },
  }, {
    tableName: 'role_permissions',
    indexes: [{ unique: true, fields: ['role_id', 'resource', 'action'] }],
  });

  RolePermission.associate = (db) => {
    RolePermission.belongsTo(db.Role, { foreignKey: 'roleId', as: 'role' });
  };

  return RolePermission;
};

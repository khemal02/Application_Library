module.exports = (sequelize, DataTypes) => {
  const Department = sequelize.define('Department', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(120), allowNull: false, unique: true },
    description: { type: DataTypes.TEXT },
  }, { tableName: 'departments' });

  Department.associate = (db) => {
    Department.hasMany(db.User, { foreignKey: 'departmentId', as: 'users' });
    Department.hasMany(db.Application, { foreignKey: 'departmentId', as: 'applications' });
    Department.hasMany(db.Idea, { foreignKey: 'departmentId', as: 'ideas' });
  };

  return Department;
};

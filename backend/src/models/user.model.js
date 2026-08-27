module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(150), allowNull: false },
    email: { type: DataTypes.STRING(150), allowNull: false, unique: true, validate: { isEmail: true } },
    passwordHash: { type: DataTypes.STRING(255), allowNull: false },
    roleId: { type: DataTypes.UUID, allowNull: false },
    departmentId: { type: DataTypes.UUID, allowNull: true },
    // Second, independent review-eligibility signal alongside departmentId — see
    // ideas.service.js#eligibleReviewers. A user can hold any number of these (a manager can own
    // both Finance and Supply Chain), unlike departmentId's single FK.
    functionalAreas: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: false, defaultValue: [] },
    avatarUrl: { type: DataTypes.STRING(500) },
    status: { type: DataTypes.ENUM('active', 'inactive'), allowNull: false, defaultValue: 'active' },
    lastLoginAt: { type: DataTypes.DATE },
    employeeId: { type: DataTypes.STRING(50) },
    phone: { type: DataTypes.STRING(30) },
    designation: { type: DataTypes.STRING(150) },
    officeLocation: { type: DataTypes.STRING(150) },
    joiningDate: { type: DataTypes.DATEONLY },
    bio: { type: DataTypes.TEXT },
    reportingManagerId: { type: DataTypes.UUID, allowNull: true },
    privacySettings: { type: DataTypes.JSONB, allowNull: true },
  }, {
    tableName: 'users',
    defaultScope: { attributes: { exclude: ['passwordHash'] } },
    scopes: { withPassword: { attributes: {} } },
  });

  User.associate = (db) => {
    User.belongsTo(db.Role, { foreignKey: 'roleId', as: 'role' });
    User.belongsTo(db.Department, { foreignKey: 'departmentId', as: 'department' });
    User.belongsTo(db.User, { foreignKey: 'reportingManagerId', as: 'reportingManager' });
    User.hasMany(db.Notification, { foreignKey: 'userId', as: 'notifications' });
    User.hasMany(db.Application, { foreignKey: 'ownerId', as: 'ownedApplications' });
    User.hasMany(db.Idea, { foreignKey: 'submittedBy', as: 'submittedIdeas' });
    User.hasMany(db.ApplicationSuggestion, { foreignKey: 'submittedBy', as: 'submittedSuggestions' });
    User.hasMany(db.UserSession, { foreignKey: 'userId', as: 'sessions' });
  };

  return User;
};

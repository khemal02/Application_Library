module.exports = (sequelize, DataTypes) => {
  const ApiEndpoint = sequelize.define('ApiEndpoint', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    applicationId: { type: DataTypes.UUID, allowNull: false },
    endpoint: { type: DataTypes.STRING(300), allowNull: false },
    method: {
      type: DataTypes.ENUM('GET', 'POST', 'PUT', 'PATCH', 'DELETE'),
      allowNull: false,
    },
    description: { type: DataTypes.TEXT },
    requestSchema: { type: DataTypes.JSONB },
    responseSchema: { type: DataTypes.JSONB },
    errorCodes: { type: DataTypes.JSONB },
  }, {
    tableName: 'api_endpoints',
    indexes: [{ fields: ['application_id'] }],
  });

  ApiEndpoint.associate = (db) => {
    ApiEndpoint.belongsTo(db.Application, { foreignKey: 'applicationId', as: 'application' });
  };

  return ApiEndpoint;
};

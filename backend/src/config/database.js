require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';

if (nodeEnv === 'production' && !process.env.DB_PASSWORD) {
  throw new Error('Missing required environment variable in production: DB_PASSWORD');
}

const base = {
  username: process.env.DB_USER || 'aams',
  password: process.env.DB_PASSWORD || 'aams_password',
  database: process.env.DB_NAME || 'aams',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  dialect: 'postgres',
  logging: false,
  define: {
    underscored: true,
    timestamps: true,
  },
  pool: {
    max: Number(process.env.DB_POOL_MAX) || 20,
    min: Number(process.env.DB_POOL_MIN) || 2,
    idle: 10000,
    acquire: 30000,
  },
};

module.exports = {
  development: { ...base },
  test: { ...base, database: `${base.database}_test` },
  production: {
    ...base,
    dialectOptions: process.env.DB_SSL === 'true'
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : {},
  },
};

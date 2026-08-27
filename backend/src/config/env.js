require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';

// In production, a missing secret must never fall back to a well-known default — fail loudly at
// boot instead of silently running with `dev_only_secret_change_me` / a guessable DB password.
if (nodeEnv === 'production') {
  const required = ['JWT_SECRET', 'DB_PASSWORD'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variable(s) in production: ${missing.join(', ')}`);
  }
}

module.exports = {
  nodeEnv,
  port: Number(process.env.PORT) || 5000,
  jwt: {
    secret: process.env.JWT_SECRET || 'dev_only_secret_change_me',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  logLevel: process.env.LOG_LEVEL || 'info',
  upload: {
    dir: process.env.UPLOAD_DIR || 'uploads',
    maxMb: Number(process.env.MAX_UPLOAD_MB) || 10,
  },
  storageDriver: process.env.STORAGE_DRIVER || 'local',
};

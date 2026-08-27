const app = require('./src/app');
const env = require('./src/config/env');
const logger = require('./src/config/logger');
const { sequelize } = require('./src/models');

async function start() {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established');

    app.listen(env.port, () => {
      logger.info(`ALMS backend listening on port ${env.port} [${env.nodeEnv}]`);
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  }
}

start();

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: reason?.message || reason });
});

const path = require('path');
const winston = require('winston');
require('winston-daily-rotate-file');
const env = require('./env');

const logsDir = path.resolve(__dirname, '..', '..', 'logs');

const fileRotateTransport = new winston.transports.DailyRotateFile({
  dirname: logsDir,
  filename: 'aams-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxFiles: '14d',
  level: 'info',
});

const logger = winston.createLogger({
  level: env.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
  ),
  defaultMeta: { service: 'alms-backend' },
  transports: [
    fileRotateTransport,
    new winston.transports.File({ dirname: logsDir, filename: 'error.log', level: 'error' }),
  ],
});

if (env.nodeEnv !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ level, message, timestamp, ...meta }) => {
        const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${level}] ${message}${rest}`;
      }),
    ),
  }));
}

module.exports = logger;

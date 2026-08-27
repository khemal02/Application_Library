const { ValidationError: SequelizeValidationError, UniqueConstraintError, ForeignKeyConstraintError } = require('sequelize');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const env = require('../config/env');

function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let error = err;

  if (err instanceof UniqueConstraintError) {
    error = ApiError.conflict('A record with these values already exists', err.errors?.map((e) => e.message));
  } else if (err instanceof ForeignKeyConstraintError) {
    error = ApiError.badRequest('This action violates a database relationship constraint');
  } else if (err instanceof SequelizeValidationError) {
    error = ApiError.badRequest('Validation failed', err.errors?.map((e) => e.message));
  } else if (!(err instanceof ApiError)) {
    error = ApiError.internal(env.nodeEnv === 'production' ? 'Internal server error' : err.message);
  }

  if (error.statusCode >= 500) {
    logger.error(err.message, { stack: err.stack, path: req.originalUrl, method: req.method });
  } else {
    logger.warn(error.message, { path: req.originalUrl, method: req.method, statusCode: error.statusCode });
  }

  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    ...(error.details ? { errors: error.details } : {}),
    ...(env.nodeEnv !== 'production' && error.statusCode >= 500 ? { stack: err.stack } : {}),
  });
}

module.exports = { notFoundHandler, errorHandler };

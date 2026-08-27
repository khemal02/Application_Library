const ApiError = require('../utils/ApiError');

/**
 * `schema` may be a plain Joi schema (validated against req.body) or an object keyed by
 * `body` / `query` / `params` for endpoints that need to validate more than the body.
 */
function validate(schema) {
  const isSectioned = schema.body || schema.query || schema.params;
  const sections = isSectioned ? schema : { body: schema };

  return (req, res, next) => {
    for (const [key, sectionSchema] of Object.entries(sections)) {
      if (!sectionSchema) continue;
      const { error, value } = sectionSchema.validate(req[key], { abortEarly: false, stripUnknown: true });
      if (error) {
        return next(ApiError.badRequest('Validation failed', error.details.map((d) => d.message)));
      }
      req[key] = value;
    }
    next();
  };
}

module.exports = validate;

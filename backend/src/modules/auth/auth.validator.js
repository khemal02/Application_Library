const Joi = require('joi');
const { strongPasswordSchema } = require('../../utils/validators');

const login = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  // Intentionally loose: this validates the login *request shape*, not a password creation
  // policy — an existing account's password may predate whatever policy is current.
  password: Joi.string().min(1).max(200).required(),
});

const changePassword = Joi.object({
  currentPassword: Joi.string().min(1).max(200).required(),
  newPassword: strongPasswordSchema.required(),
});

module.exports = { login, changePassword };

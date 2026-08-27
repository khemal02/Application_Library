const Joi = require('joi');
const { passwordSchema, FUNCTIONAL_AREAS } = require('../../utils/validators');

const create = Joi.object({
  name: Joi.string().max(150).required(),
  email: Joi.string().email({ tlds: { allow: false } }).max(150).required(),
  password: passwordSchema.required(),
  roleId: Joi.string().uuid().required(),
  departmentId: Joi.string().uuid().allow(null),
  functionalAreas: Joi.array().items(Joi.string().valid(...FUNCTIONAL_AREAS)),
  status: Joi.string().valid('active', 'inactive'),
});

const update = Joi.object({
  name: Joi.string().max(150),
  roleId: Joi.string().uuid(),
  departmentId: Joi.string().uuid().allow(null),
  functionalAreas: Joi.array().items(Joi.string().valid(...FUNCTIONAL_AREAS)),
  status: Joi.string().valid('active', 'inactive'),
  avatarUrl: Joi.string().uri().allow(null, ''),
});

const updateProfile = Joi.object({
  name: Joi.string().max(150),
  avatarUrl: Joi.string().uri().allow(null, ''),
});

module.exports = { create, update, updateProfile };

const Joi = require('joi');

const updateProfile = Joi.object({
  phone: Joi.string().max(30).allow('', null),
  bio: Joi.string().max(1000).allow('', null),
});

const updatePrivacy = Joi.object({
  showEmail: Joi.boolean().required(),
  showPhone: Joi.boolean().required(),
  showDepartment: Joi.boolean().required(),
  showDesignation: Joi.boolean().required(),
  allowProfileView: Joi.boolean().required(),
});

module.exports = { updateProfile, updatePrivacy };

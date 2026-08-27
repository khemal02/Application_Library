const Joi = require('joi');

const create = Joi.object({
  entityType: Joi.string().max(60).required(),
  entityId: Joi.string().uuid().required(),
  parentCommentId: Joi.string().uuid().allow(null),
  // Allowed empty because a note can be posted as just a screenshot attachment with no text —
  // the attachment is uploaded as a separate follow-up request against the created comment's id,
  // so the comment record itself still needs to exist even with nothing typed into it.
  body: Joi.string().allow('').required(),
});

const listQuery = Joi.object({
  entityType: Joi.string().max(60).required(),
  entityId: Joi.string().uuid().required(),
}).unknown(true);

module.exports = { create, listQuery };

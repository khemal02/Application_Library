const Joi = require('joi');

const toggle = Joi.object({
  entityType: Joi.string().max(60).required(),
  entityId: Joi.string().uuid().required(),
  voteType: Joi.string().valid('upvote', 'bookmark', 'like').default('upvote'),
});

const summaryQuery = Joi.object({
  entityType: Joi.string().max(60).required(),
  entityId: Joi.string().uuid().required(),
}).unknown(true);

module.exports = { toggle, summaryQuery };

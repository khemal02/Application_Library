const Joi = require('joi');

// GET / — filterable by status, priority, stage (a stage row's own `stage` column — see
// applicationTracking.service.js#list) and assigneeId (a stage row's assignee, not the track's
// owner). None required; an empty query lists everything.
const listQuery = Joi.object({
  status: Joi.string().valid('active', 'on_hold', 'live', 'cancelled'),
  priority: Joi.string().valid('critical', 'high', 'medium', 'low'),
  stage: Joi.string().valid('scoping', 'development', 'testing', 'deployment'),
  assigneeId: Joi.string().uuid(),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
});

const idParam = Joi.object({
  id: Joi.string().uuid().required(),
});

// PATCH /:id — the server owns status, ideaId, applicationId and closedAt (1c); Joi.forbidden()
// rather than merely absent, so a caller who tries anyway gets a 400 naming exactly why, not a
// silently-dropped field.
const update = Joi.object({
  priority: Joi.string().valid('critical', 'high', 'medium', 'low'),
  targetGoLive: Joi.date().iso().allow(null),
  ownerId: Joi.string().uuid().allow(null),
  name: Joi.string().max(200).allow('', null),
  description: Joi.string().allow('', null),
  status: Joi.forbidden(),
  ideaId: Joi.forbidden(),
  applicationId: Joi.forbidden(),
  closedAt: Joi.forbidden(),
});

const stageParams = Joi.object({
  id: Joi.string().uuid().required(),
  stage: Joi.string().valid('scoping', 'development', 'testing', 'deployment').required(),
});

const stageBody = Joi.object({
  status: Joi.string().valid('not_started', 'in_progress', 'complete'),
  assigneeId: Joi.string().uuid().allow(null),
  startDate: Joi.date().iso().allow(null),
  endDate: Joi.date().iso().allow(null),
});

// POST /:id/stages/assign — mirrors changeRequests.validator.js#bulkAssignBody exactly (same
// "each key optional independently, .allow(null) clears" shape), four stages instead of three.
const assignBody = Joi.object({
  scoping: Joi.string().uuid().allow(null),
  development: Joi.string().uuid().allow(null),
  testing: Joi.string().uuid().allow(null),
  deployment: Joi.string().uuid().allow(null),
});

const holdBody = Joi.object({
  reason: Joi.string().trim().min(1).required(),
});

const cancelBody = Joi.object({
  reason: Joi.string().trim().min(1).required(),
});

module.exports = {
  listQuery, idParam, update, stageParams, stageBody, assignBody, holdBody, cancelBody,
};

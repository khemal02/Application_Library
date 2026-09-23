const Joi = require('joi');

// GET / — filterable by status, priority, stage (a stage row's own `stage` column — see
// applicationTracking.service.js#list), assigneeId (a stage row's assignee — backs "Assigned to
// me") and ownerId (the track's own owner — backs "My Apps"). None required; an empty query lists
// everything. Either "mine" filter also switches the list's sort order to start-date-first — see
// applicationTracking.service.js#list.
const listQuery = Joi.object({
  status: Joi.string().valid('active', 'on_hold', 'live', 'cancelled'),
  priority: Joi.string().valid('critical', 'high', 'medium', 'low'),
  stage: Joi.string().valid('development', 'testing', 'deployment'),
  assigneeId: Joi.string().uuid(),
  ownerId: Joi.string().uuid(),
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
  stage: Joi.string().valid('development', 'testing', 'deployment').required(),
});

const stageBody = Joi.object({
  status: Joi.string().valid('not_started', 'in_progress', 'complete'),
  assigneeId: Joi.string().uuid().allow(null),
  startDate: Joi.date().iso().allow(null),
  endDate: Joi.date().iso().allow(null),
  // No longer a user-typed external link — the frontend always sends the app-relative URL a file
  // upload returns (e.g. `/uploads/application_track_stage/<id>.pdf`), which plain `.uri()` would
  // reject for having no scheme. `allowRelative` accepts that shape; `.max(500)` stays as a sanity
  // cap, not a real security boundary (this value is never rendered as HTML, only used as an <a href>).
  documentUrl: Joi.string().uri({ allowRelative: true }).max(500).allow(null),
});

// POST /:id/stages/assign — mirrors changeRequests.validator.js#bulkAssignBody exactly (same
// "each key optional independently, .allow(null) clears" shape).
const assignBody = Joi.object({
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

// PATCH /:id/stages/:stage/advance — same params shape as the plain stage PATCH; no body needed
// beyond an optional finishedDate override, mirroring stageBody's own optional date fields.
const advanceStageParams = stageParams;
const advanceStageBody = Joi.object({
  finishedDate: Joi.date().iso().allow(null),
});

// PATCH /:id/stages/:stage/send-back — the one place a stage may move backward; reason follows
// this module's own hold/cancel convention (trimmed, non-empty), not a bare max-length cap.
const sendBackStageParams = stageParams;
const sendBackStageBody = Joi.object({
  reason: Joi.string().trim().min(1).required(),
});

// PATCH /:id/reorder — see applicationTracking.service.js#reorder. At least one of the two must be
// given (moving relative to nothing at all is meaningless); either may be null/omitted on its own
// to mean "top of the queue" or "bottom of the queue."
const reorderBody = Joi.object({
  beforeTrackId: Joi.string().uuid().allow(null),
  afterTrackId: Joi.string().uuid().allow(null),
}).or('beforeTrackId', 'afterTrackId');

// PATCH /queue/reorder — the combined-queue version, spanning both application_tracks and
// change_requests (see applicationTracking.service.js#reorderQueueItem /
// queueRank.service.js). Each of `item`/`before`/`after` names which table a queue row lives in.
const queueItemRef = Joi.object({
  itemType: Joi.string().valid('track', 'changeRequest').required(),
  id: Joi.string().uuid().required(),
});
const queueReorderBody = Joi.object({
  item: queueItemRef.required(),
  before: queueItemRef.allow(null),
  after: queueItemRef.allow(null),
}).or('before', 'after');

module.exports = {
  listQuery,
  idParam,
  update,
  stageParams,
  stageBody,
  assignBody,
  holdBody,
  cancelBody,
  advanceStageParams,
  advanceStageBody,
  sendBackStageParams,
  sendBackStageBody,
  reorderBody,
  queueReorderBody,
};

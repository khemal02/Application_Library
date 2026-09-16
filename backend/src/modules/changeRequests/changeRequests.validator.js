const Joi = require('joi');

// A change request is always born `pending` (the column default) — `status` is a hard-forbidden
// key here, not merely absent, so a caller who tries to set one anyway is told so with a 400
// rather than having it silently dropped. Creating one outright `implemented` (or `approved`)
// would skip every governance/delivery rule this module enforces everywhere else. `requestedBy`
// is absent entirely (not forbidden) — the service always uses the caller's own id; a client
// value there is simply ignored, not worth failing the whole request over.
const create = Joi.object({
  applicationId: Joi.string().uuid().required(),
  title: Joi.string().max(200).required(),
  description: Joi.string().allow('', null),
  status: Joi.forbidden(),
});

// PUT — deliberately its own schema, not forked from `create`: `applicationId` and `requestedBy`
// are absent entirely, so the shared validate() middleware's stripUnknown strips either one out
// of the body before it ever reaches the service — even though scopeToParent unconditionally
// re-injects applicationId into req.body for every nested route. Reparenting a change request to
// a different application could hand the caller approval rights over it (rule 6 in the project
// report); re-attributing it to someone who never raised it is just as wrong. `status` IS allowed
// here (unlike create) — see changeRequests.service.js#update for the governance transitions Joi
// can't express.
const update = Joi.object({
  title: Joi.string().max(200),
  description: Joi.string().allow('', null),
  status: Joi.string().valid('pending', 'in_review', 'approved', 'rejected', 'implemented'),
});

// PATCH /applications/:applicationId/change-requests/:id/stages/:stage — see
// changeRequests.service.js#updateStage for the transition rules Joi can't express (ordering,
// forward-only status, the approval gate, authorization).
const updateStageParams = Joi.object({
  applicationId: Joi.string().uuid().required(),
  id: Joi.string().uuid().required(),
  stage: Joi.string().valid('development', 'testing', 'deployment').required(),
});

const updateStageBody = Joi.object({
  status: Joi.string().valid('not_started', 'in_progress', 'complete'),
  assigneeId: Joi.string().uuid().allow(null),
  // .allow(null) here too, same as assigneeId — the UI sends null for an unset/cleared date (an
  // empty <input type="date"> reads back as '', which the page turns into null), not an omitted
  // key. Notes no longer live here — see comments.service.js's 'change_request_stage' branch.
  startDate: Joi.date().iso().allow(null),
  endDate: Joi.date().iso().allow(null),
  // No longer a user-typed external link — the frontend always sends the app-relative URL a file
  // upload returns (e.g. `/uploads/change_request_stage/<id>.pdf`), which plain `.uri()` would
  // reject for having no scheme. `allowRelative` accepts that shape.
  documentUrl: Joi.string().uri({ allowRelative: true }).max(500).allow(null),
});

// PATCH /applications/:applicationId/change-requests/:id/assignments — see
// changeRequests.service.js#bulkAssignStages. Each key is optional independently (an absent key
// leaves that stage alone); `.allow(null)` lets an explicit null clear an assignee, distinct from
// the key being absent at all.
const bulkAssignParams = Joi.object({
  applicationId: Joi.string().uuid().required(),
  id: Joi.string().uuid().required(),
});

const bulkAssignBody = Joi.object({
  development: Joi.string().uuid().allow(null),
  testing: Joi.string().uuid().allow(null),
  deployment: Joi.string().uuid().allow(null),
});

// GET /change-requests/my-stages?stage=development — see changeRequests.service.js#myAssignedStages.
const myStagesQuery = Joi.object({
  stage: Joi.string().valid('development', 'testing', 'deployment').required(),
});

// PATCH /applications/:applicationId/change-requests/:id/implement — see
// changeRequests.service.js#implement. No body; params only.
const implementParams = Joi.object({
  applicationId: Joi.string().uuid().required(),
  id: Joi.string().uuid().required(),
});

// PATCH .../:id/stages/:stage/advance — same params shape as the plain stage PATCH (the service
// is what actually rejects 'deployment', which has no next stage — see
// changeRequests.service.js#advanceStage). Body is optional and narrower than updateStageBody: the
// only thing worth overriding is the completing stage's own end date, same default-unless-given
// rule updateStage already applies elsewhere.
const advanceStageParams = updateStageParams;
const advanceStageBody = Joi.object({
  endDate: Joi.date().iso().allow(null),
});

// PATCH .../:id/stages/:stage/send-back — same params shape as the plain stage PATCH ('development'
// is rejected by the service, which has no previous stage). `reason` validated the same way this
// module's other required free-text fields are (see `title` above) — required, capped, not merely
// optional like `description`, since a silent/empty reason defeats the entire point of this action.
const sendBackStageParams = updateStageParams;
const sendBackStageBody = Joi.object({
  reason: Joi.string().max(2000).required(),
});

module.exports = {
  create, update, updateStageParams, updateStageBody, bulkAssignParams, bulkAssignBody, myStagesQuery, implementParams,
  advanceStageParams, advanceStageBody, sendBackStageParams, sendBackStageBody,
};

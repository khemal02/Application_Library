const Joi = require('joi');

// A reported issue is always born `needs_triage`, reported by the caller — status, reportedBy and
// assigneeId are hard-forbidden, not merely absent, so a client that tries to set any of them is
// told so with a 400 rather than having it silently dropped (see the project report, Stage 1b).
// applicationId is deliberately absent (not forbidden) — the controller reads it from the route
// param (req.params.applicationId), not the body, so there's nothing here to strip or trust.
const create = Joi.object({
  title: Joi.string().max(200).required(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
  description: Joi.string().allow('', null),
  affectedVersion: Joi.string().max(50).allow('', null),
  status: Joi.forbidden(),
  reportedBy: Joi.forbidden(),
  assigneeId: Joi.forbidden(),
});

const idParams = Joi.object({
  applicationId: Joi.string().uuid().required(),
  id: Joi.string().uuid().required(),
});

// Shape only — the outcome-specific requirements (duplicateOfId required for `duplicate`, note
// required for known_limitation/duplicate/not_an_issue) are enforced in issues.service.js#triage,
// since Joi's .when() would only add noise here for four branches this simple.
const triageBody = Joi.object({
  outcome: Joi.string().valid('accept', 'known_limitation', 'duplicate', 'not_an_issue').required(),
  assigneeId: Joi.string().uuid().allow(null),
  duplicateOfId: Joi.string().uuid(),
  note: Joi.string().allow('', null),
});

const assignBody = Joi.object({
  assigneeId: Joi.string().uuid().allow(null).required(),
});

const noteBody = Joi.object({
  note: Joi.string().min(1).required(),
});

module.exports = {
  create, idParams, triageBody, assignBody, noteBody,
};

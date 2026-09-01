const Joi = require('joi');
const { INDUSTRIES, FUNCTIONAL_AREAS } = require('../../utils/validators');

// Forked from ideas.validator.js. No `category` field at all — this module IS the
// existing_app_feature lane now, so `applicationId` is unconditionally required (never a
// `.when()` conditional) and industry/functionalArea are unconditionally optional (always
// inherited from the target Application in featureRequests.service.js#create, same as
// departmentId already was).
const create = Joi.object({
  title: Joi.string().max(200).required(),
  description: Joi.string().required(),
  applicationId: Joi.string().uuid().required(),
  industry: Joi.string().valid(...INDUSTRIES).allow('', null),
  functionalArea: Joi.string().valid(...FUNCTIONAL_AREAS).allow('', null),
  internalUse: Joi.boolean(),
  businessProblem: Joi.string().allow('', null),
  proposedSolution: Joi.string().allow('', null),
  expectedBenefits: Joi.string().allow('', null),
  aiUsage: Joi.string().allow('', null),
  technologySuggestion: Joi.string().allow('', null),
  technologiesAndEfficiency: Joi.string().allow('', null),
  // Not collected on the form — auto-filled from the target Application's own department (falling
  // back to the submitter's) in featureRequests.service.js#create. An explicit value here still
  // wins. Display/org-chart data only.
  departmentId: Joi.string().uuid().allow(null),
  targetUsers: Joi.string().max(300).allow('', null),
  estimatedComplexity: Joi.string().valid('low', 'medium', 'high'),
  estimatedDevTime: Joi.string().max(60).allow('', null),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical'),
  tags: Joi.array().items(Joi.string().max(60)),
});

// `applicationId` is NOT forked here — a feature request can't be re-pointed at a different
// application after the fact, same reasoning as change requests' own update schema.
const update = create
  .fork(['title', 'description', 'applicationId'], (s) => s.optional())
  .fork(['applicationId'], () => Joi.forbidden());

// One panel member's own verdict — see featureRequests.service.js#submitReview. Identical shape
// to ideas.validator.js#submitReview: a reviewer's verdict has 3 advisory tiers, an approver's/
// tie-break's is strictly binary (enforced in the service, which knows the caller's panel role).
const submitReview = Joi.object({
  decision: Joi.string().valid('approve', 'request_changes', 'reject').required(),
  note: Joi.string().allow('', null),
});

const addParticipants = Joi.object({
  kind: Joi.string().valid('reviewer', 'approver').required(),
  userIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

const panelCandidatesQuery = Joi.object({
  kind: Joi.string().valid('reviewer', 'approver').required(),
});

module.exports = {
  create, update, submitReview, addParticipants, panelCandidatesQuery,
};

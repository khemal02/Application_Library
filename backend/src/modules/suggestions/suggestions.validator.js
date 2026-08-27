const Joi = require('joi');
const { FUNCTIONAL_AREAS } = require('../../utils/validators');

const create = Joi.object({
  applicationId: Joi.string().uuid().required(),
  // Neither is collected on the submit form — suggestions.service.js#create auto-fills both from
  // the target Application (department falls back to the submitter's own if the application has
  // none). An explicit value here (e.g. an admin creating on someone's behalf) still wins.
  departmentId: Joi.string().uuid().allow(null),
  functionalArea: Joi.string().valid(...FUNCTIONAL_AREAS).allow('', null),
  title: Joi.string().max(200).required(),
  description: Joi.string().required(),
  currentProblem: Joi.string().allow('', null),
  suggestedSolution: Joi.string().allow('', null),
  expectedBenefit: Joi.string().allow('', null),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical'),
  module: Joi.string().max(120).allow('', null),
});

const update = create.fork(['applicationId', 'title', 'description'], (s) => s.optional());

const transition = Joi.object({
  // 'discussion' is retired — request_changes (the only thing that ever led there) is gone now
  // that ceo's decision is binding and terminal, same as Ideas'. 'rejected' is the review panel's
  // other terminal outcome alongside 'approved'.
  toStatus: Joi.string().valid(
    'submitted', 'technical_review', 'approved', 'assigned', 'implemented', 'closed', 'rejected',
  ).required(),
  note: Joi.string().allow('', null),
  assignedTo: Joi.string().uuid().when('toStatus', { is: 'assigned', then: Joi.required(), otherwise: Joi.optional() }),
});

// One panel-slot vote (team_lead/manager) at technical_review — see
// suggestions.service.js#submitReview. request_changes is gone — only the ceo slot can end
// anything now, so a parallel reviewer's "send it back" has no defined meaning. Mirrors
// ideas.validator.js's identical schema.
const submitReview = Joi.object({
  decision: Joi.string().valid('approve', 'reject').required(),
  note: Joi.string().allow('', null),
});

// The CEO's binding decision that finalizes technical_review — see
// suggestions.service.js#submitDecision. No override escape hatch anymore: the ceo slot is
// hard-gated on team_lead AND manager both having recorded, mirroring Ideas' TERMINAL_ROLE gate
// exactly. Mirrors ideas.validator.js's identical schema.
const submitDecision = Joi.object({
  decision: Joi.string().valid('approve', 'reject').required(),
  note: Joi.string().allow('', null),
});

module.exports = { create, update, transition, submitReview, submitDecision };

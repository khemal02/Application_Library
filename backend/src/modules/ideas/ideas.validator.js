const Joi = require('joi');
const { INDUSTRIES, FUNCTIONAL_AREAS } = require('../../utils/validators');

// No `category`/`applicationId` — as of the Ideas/Feature-Requests split, this module only ever
// creates a 'new_idea' row ("Modify Current Application" is featureRequests.validator.js now,
// with its own unconditionally-required applicationId).
const create = Joi.object({
  title: Joi.string().max(200).required(),
  description: Joi.string().required(),
  industry: Joi.string().valid(...INDUSTRIES).allow('', null),
  // STILL required — it used to be "the ONLY thing that decides who reviews it" (functional-area-
  // matched routing). That's gone — the panel is composed manually, person by person (see
  // ideas.service.js#addParticipants) — so functionalArea is display/reporting-only from here on,
  // same as industry/department. Whether it should still be required given that is a product
  // call outside this change's scope, flagged rather than changed here.
  functionalArea: Joi.string().valid(...FUNCTIONAL_AREAS).required(),
  internalUse: Joi.boolean(),
  businessProblem: Joi.string().allow('', null),
  proposedSolution: Joi.string().allow('', null),
  expectedBenefits: Joi.string().allow('', null),
  aiUsage: Joi.string().allow('', null),
  technologySuggestion: Joi.string().allow('', null),
  technologiesAndEfficiency: Joi.string().allow('', null),
  // Not collected on the New Idea form — the submitter is never asked. ideas.service.js#create
  // auto-fills it from req.user.departmentId when omitted; an explicit value here (e.g. an admin
  // creating on someone's behalf) still wins. Display/org-chart data only — review routing isn't
  // driven by any field on the idea anymore, see the panel model in ideas.service.js.
  departmentId: Joi.string().uuid().allow(null),
  targetUsers: Joi.string().max(300).allow('', null),
  estimatedComplexity: Joi.string().valid('low', 'medium', 'high'),
  estimatedDevTime: Joi.string().max(60).allow('', null),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical'),
  tags: Joi.array().items(Joi.string().max(60)),
});

// functionalArea is ALSO forked to plain-optional here, not just title/description — update() is
// used for partial edits (e.g. IdeaDetailPage.jsx's inline description-only edit sends just
// `{ description }`), so it can't inherit create's conditionally-required rule, or a partial
// payload that simply doesn't touch functionalArea would fail validation on a field it never
// meant to change. Explicitly replaces the whole `.when()` conditional rather than layering
// `.optional()` on top of it, which Joi doesn't reliably override a nested required() with.
const update = create
  .fork(['title', 'description'], (s) => s.optional())
  .fork(['functionalArea'], () => Joi.string().valid(...FUNCTIONAL_AREAS).allow('', null));

// One panel member's own verdict — see ideas.service.js#submitReview. A REVIEWER's verdict is
// advisory (R2: never ends anything) and has three tiers — approve/request_changes/reject, shown
// in the UI as Fully supported/Partially supported/Not supported. An APPROVER's or the CEO
// tie-break's decision is still strictly binary (approve/reject only) since that vote can actually
// end the idea and there's no meaningful middle ground for a binding call — Joi can't tell which
// kind the caller is (it only sees the request body, not their panel row), so that narrower
// restriction is enforced in the service once the caller's row is loaded. No `asRole` anymore
// either — there is no super-admin override (R10); panel membership itself is the authorization,
// so the caller can only ever record their own row. `ownerId` is only actually required when this
// call turns out to be the approve that completes the approver set, on a new_idea with no
// Application yet — Joi sees only the request body, not the idea's panel state, so that
// conditional requirement is enforced in the service (finalizeIdea).
const submitReview = Joi.object({
  decision: Joi.string().valid('approve', 'request_changes', 'reject').required(),
  note: Joi.string().allow('', null),
  ownerId: Joi.string().uuid(),
});

// Adds one or more people to an idea's panel — see ideas.service.js#addParticipants. Who may call
// this (R7: submitter/ceo/admin) and R3 (never the submitter) are enforced in the service, not
// here — Joi sees only the request body, not the idea being modified.
const addParticipants = Joi.object({
  kind: Joi.string().valid('reviewer', 'approver').required(),
  userIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

// GET /:id/panel-candidates?kind=reviewer|approver — see ideas.service.js#panelCandidates.
const panelCandidatesQuery = Joi.object({
  kind: Joi.string().valid('reviewer', 'approver').required(),
});

module.exports = {
  create, update, submitReview, addParticipants, panelCandidatesQuery,
};

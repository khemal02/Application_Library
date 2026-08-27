const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const { requireRecordOwnership } = require('../../middlewares/ownership.middleware');
const validate = require('../../middlewares/validate.middleware');
const { ApplicationSuggestion } = require('../../models');
const controller = require('./suggestions.controller');
const {
  create, update, transition, submitReview, submitDecision,
} = require('./suggestions.validator');

const router = express.Router();
router.use(authenticate);

const ownSuggestionOnly = requireRecordOwnership(() => ApplicationSuggestion, 'submittedBy');

router.get('/', authorize('suggestions', 'read'), controller.list);
router.get('/:id', authorize('suggestions', 'read'), controller.getById);
router.get('/:id/status-history', authorize('suggestions', 'read'), controller.statusHistory);
router.get('/:id/eligible-reviewers', authorize('suggestions', 'review'), controller.eligibleReviewers);
router.post('/', authorize('suggestions', 'create'), validate(create), controller.create);
router.put('/:id', authorize('suggestions', 'update'), ownSuggestionOnly, validate(update), controller.update);
router.patch('/:id/status', authorize('suggestions', 'review'), validate(transition), controller.transition);
router.post('/:id/reviews', authorize('suggestions', 'review'), validate(submitReview), controller.submitReview);
router.post('/:id/decision', authorize('suggestions', 'review'), validate(submitDecision), controller.submitDecision);
router.delete('/:id', authorize('suggestions', 'delete'), ownSuggestionOnly, controller.remove);

module.exports = router;

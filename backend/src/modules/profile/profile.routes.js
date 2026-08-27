const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { sensitiveActionLimiter } = require('../../middlewares/rateLimit.middleware');
const validate = require('../../middlewares/validate.middleware');
const controller = require('./profile.controller');
const { updateProfile, updatePrivacy } = require('./profile.validator');

// Every route here operates on req.user (the authenticated caller) only — there is no :id
// param and no RBAC resource check, by design: a user always has full access to their own
// profile/account/privacy/sessions/activity, regardless of role.
const router = express.Router();
router.use(authenticate);

router.get('/me', controller.getProfile);
router.patch('/me', validate(updateProfile), controller.updateProfile);

router.get('/account', controller.getAccount);

router.get('/privacy', controller.getPrivacy);
router.put('/privacy', validate(updatePrivacy), controller.updatePrivacy);

router.get('/sessions', controller.listSessions);
router.delete('/sessions/:id', sensitiveActionLimiter, controller.revokeSession);
router.delete('/sessions', sensitiveActionLimiter, controller.revokeOtherSessions);

router.get('/activity', controller.getActivity);

module.exports = router;

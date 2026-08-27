const express = require('express');
const validate = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { loginLimiter, sensitiveActionLimiter } = require('../../middlewares/rateLimit.middleware');
const controller = require('./auth.controller');
const { login, changePassword } = require('./auth.validator');

const router = express.Router();

router.post('/login', loginLimiter, validate(login), controller.login);
router.post('/logout', authenticate, controller.logout);
router.get('/me', authenticate, controller.me);
router.post('/change-password', authenticate, sensitiveActionLimiter, validate(changePassword), controller.changePassword);

module.exports = router;

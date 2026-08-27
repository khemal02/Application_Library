const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const controller = require('./notifications.controller');

const router = express.Router();
router.use(authenticate);

router.get('/', controller.list);
router.get('/unread-count', controller.unreadCount);
router.patch('/:id/read', controller.markRead);
router.patch('/read-all', controller.markAllRead);

module.exports = router;

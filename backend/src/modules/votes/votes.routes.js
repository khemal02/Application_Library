const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const validate = require('../../middlewares/validate.middleware');
const controller = require('./votes.controller');
const { toggle, summaryQuery } = require('./votes.validator');

const router = express.Router();
router.use(authenticate);

router.get('/summary', authorize('votes', 'read'), validate({ query: summaryQuery }), controller.summary);
router.post('/toggle', authorize('votes', 'create'), validate(toggle), controller.toggle);

module.exports = router;

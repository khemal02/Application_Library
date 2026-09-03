const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const { requireApplicationAccess, requireRecordOwnership } = require('../../middlewares/ownership.middleware');
const validate = require('../../middlewares/validate.middleware');
const { Application } = require('../../models');
const controller = require('./applications.controller');
const { create, update } = require('./applications.validator');

// Narrower than requireApplicationAccess (which also admits anyone in the same department) — the
// Edit form changes the application's own catalog record (name, status, links, dates), and per
// explicit instruction that's the owner's call, or a true super-admin's, and nobody else's, even
// a Team Lead/Manager/CEO who happens to share the department. Deliberately its own check, not a
// change to requireApplicationAccess itself — that one is shared by every documentation
// sub-resource nested under an application (tech stack, features, API docs, ...), and narrowing it
// here would have silently narrowed all of those too.
const ownApplicationOnly = requireRecordOwnership(() => Application, 'ownerId');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('applications', 'read'), controller.list);
router.get('/eligible-owners', authorize('applications', 'update'), controller.eligibleOwners);
router.get('/:id', authorize('applications', 'read'), controller.getById);
router.post('/', authorize('applications', 'create'), validate(create), controller.create);
router.put('/:id', authorize('applications', 'update'), ownApplicationOnly, validate(update), controller.update);
router.delete('/:id', authorize('applications', 'delete'), requireApplicationAccess('id'), controller.remove);

module.exports = router;

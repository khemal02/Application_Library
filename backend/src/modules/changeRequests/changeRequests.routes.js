const { createNestedCrudRouter } = require('../../utils/nestedResourceRouter');
const { requireRecordOwnership } = require('../../middlewares/ownership.middleware');
const { ChangeRequest } = require('../../models');
const controller = require('./changeRequests.controller');
const { create, update } = require('./changeRequests.validator');

// Create/read/update are open to every role regardless of application ownership/department — see
// requireOwnership's doc comment on createNestedCrudRouter. Delete is narrower: only the person
// who raised a given change request (or a true super-admin) may delete it — same ownership shape
// as ideas/suggestions, just scoped to `requestedBy` instead of `submittedBy`.
const ownChangeRequestOnly = requireRecordOwnership(() => ChangeRequest, 'requestedBy');

module.exports = createNestedCrudRouter({
  resource: 'change_requests',
  controller,
  validators: { create, update },
  requireOwnership: false,
  deleteOwnerCheck: ownChangeRequestOnly,
});

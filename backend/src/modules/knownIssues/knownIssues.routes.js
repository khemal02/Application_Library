const { createNestedCrudRouter } = require('../../utils/nestedResourceRouter');
const controller = require('./knownIssues.controller');
const { create, update } = require('./knownIssues.validator');

module.exports = createNestedCrudRouter({ resource: 'known_issues', controller, validators: { create, update } });

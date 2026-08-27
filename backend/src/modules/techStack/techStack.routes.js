const { createNestedCrudRouter } = require('../../utils/nestedResourceRouter');
const controller = require('./techStack.controller');
const { create, update } = require('./techStack.validator');

module.exports = createNestedCrudRouter({ resource: 'tech_stack', controller, validators: { create, update } });

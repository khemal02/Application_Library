const { createNestedCrudRouter } = require('../../utils/nestedResourceRouter');
const controller = require('./timeline.controller');
const { create, update } = require('./timeline.validator');

module.exports = createNestedCrudRouter({ resource: 'timeline', controller, validators: { create, update } });

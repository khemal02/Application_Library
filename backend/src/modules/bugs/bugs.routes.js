const { createNestedCrudRouter } = require('../../utils/nestedResourceRouter');
const controller = require('./bugs.controller');
const { create, update } = require('./bugs.validator');

module.exports = createNestedCrudRouter({ resource: 'bugs', controller, validators: { create, update } });

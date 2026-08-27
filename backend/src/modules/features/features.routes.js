const { createNestedCrudRouter } = require('../../utils/nestedResourceRouter');
const controller = require('./features.controller');
const { create, update } = require('./features.validator');

module.exports = createNestedCrudRouter({ resource: 'features', controller, validators: { create, update } });

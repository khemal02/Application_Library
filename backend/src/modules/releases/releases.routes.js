const { createNestedCrudRouter } = require('../../utils/nestedResourceRouter');
const controller = require('./releases.controller');
const { create, update } = require('./releases.validator');

module.exports = createNestedCrudRouter({ resource: 'releases', controller, validators: { create, update } });

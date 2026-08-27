const { createNestedCrudRouter } = require('../../utils/nestedResourceRouter');
const controller = require('./roadmap.controller');
const { create, update } = require('./roadmap.validator');

module.exports = createNestedCrudRouter({ resource: 'roadmap', controller, validators: { create, update } });

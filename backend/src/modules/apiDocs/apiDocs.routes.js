const { createNestedCrudRouter } = require('../../utils/nestedResourceRouter');
const controller = require('./apiDocs.controller');
const { create, update } = require('./apiDocs.validator');

module.exports = createNestedCrudRouter({ resource: 'api_docs', controller, validators: { create, update } });

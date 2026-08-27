const { createNestedCrudRouter } = require('../../utils/nestedResourceRouter');
const controller = require('./dbDocs.controller');
const { create, update } = require('./dbDocs.validator');

module.exports = createNestedCrudRouter({ resource: 'db_docs', controller, validators: { create, update } });

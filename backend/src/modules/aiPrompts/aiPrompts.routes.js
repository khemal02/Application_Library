const { createNestedCrudRouter } = require('../../utils/nestedResourceRouter');
const controller = require('./aiPrompts.controller');
const { create, update } = require('./aiPrompts.validator');

module.exports = createNestedCrudRouter({ resource: 'ai_prompts', controller, validators: { create, update } });

'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex('ideas', ['reviewer_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('ideas', ['reviewer_id']);
  },
};

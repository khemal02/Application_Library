'use strict';

// Captured at idea-approval time alongside the owner picker (see ideas.service.js#finalizeIdea) —
// when the deciding approver names an Application Owner, they can also set when work is expected
// to start. Pairs with the track's existing `target_go_live` column (shown as "Expected Deployment
// Date" on that same approval form) — both nullable, since neither was ever required before now
// and a caller who skips them just leaves the track's dates unset, same as today.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('application_tracks', 'start_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('application_tracks', 'start_date');
  },
};

'use strict';

// The "Add Change Request" popup was simplified down to a single input bound to `title`, but
// that column was still STRING(200) — a hard, UI-invisible cap left over from when title was a
// short label alongside a separate description field. Now it's the only field, so it needs the
// same unlimited TEXT type description already had.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('change_requests', 'title', {
      type: Sequelize.TEXT,
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('change_requests', 'title', {
      type: Sequelize.STRING(200),
      allowNull: false,
    });
  },
};

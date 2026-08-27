'use strict';

// Follow-up to the initial schema: these tables are routinely sorted by created_at/updated_at
// in list/dashboard queries but had no index backing that sort, so they'd degrade to a
// sequential scan + sort under real data volume.
module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex('audit_logs', ['created_at'], { name: 'audit_logs_created_at' });
    await queryInterface.addIndex('notifications', ['user_id', 'created_at'], { name: 'notifications_user_created_at' });
    await queryInterface.addIndex('applications', ['updated_at'], { name: 'applications_updated_at' });
    await queryInterface.addIndex('applications', ['priority'], { name: 'applications_priority' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('applications', 'applications_priority');
    await queryInterface.removeIndex('applications', 'applications_updated_at');
    await queryInterface.removeIndex('notifications', 'notifications_user_created_at');
    await queryInterface.removeIndex('audit_logs', 'audit_logs_created_at');
  },
};

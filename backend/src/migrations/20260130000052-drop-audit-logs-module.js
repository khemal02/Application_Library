'use strict';

// The Audit Logs module (its own viewing page, the auditLogs backend module, and every
// logAction() call site across every other module) is being removed entirely — the app stops
// keeping any audit trail at all. This migration is the database half:
//   1. Delete the 'audit_logs' resource's role_permissions grants (mirrors the technique
//      20260130000048-drop-suggestions-module.js already used).
//   2. Drop the audit_logs table — no enum types on it (plain STRING columns), unlike
//      Suggestions, so nothing further to clean up there.
//
// down() restores the table exactly as it existed (matching auditLog.model.js /
// 20260101000001-initial-schema.js) and re-grants the same role_permissions rows — it cannot
// bring back any audit trail rows that existed before this migration ran, same as every other
// table-drop migration in this codebase.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query("DELETE FROM role_permissions WHERE resource = 'audit_logs';");
    await queryInterface.dropTable('audit_logs');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.createTable('audit_logs', {
      id: {
        type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL',
      },
      action: { type: Sequelize.STRING(20), allowNull: false },
      entity_type: { type: Sequelize.STRING(60), allowNull: false },
      entity_id: { type: Sequelize.UUID, allowNull: true },
      old_value: { type: Sequelize.JSONB },
      new_value: { type: Sequelize.JSONB },
      ip_address: { type: Sequelize.STRING(60) },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('audit_logs', ['entity_type', 'entity_id']);
    await queryInterface.addIndex('audit_logs', ['user_id']);

    const { v4: uuidv4 } = require('uuid');
    const [roles] = await queryInterface.sequelize.query("SELECT id, name FROM roles WHERE name IN ('ceo', 'manager', 'team_lead')");
    const roleId = (name) => roles.find((r) => r.name === name)?.id;
    const now = new Date();
    const rows = [];
    const grant = (roleName, actions) => {
      const id = roleId(roleName);
      if (!id) return;
      actions.forEach((action) => rows.push({
        id: uuidv4(), role_id: id, resource: 'audit_logs', action, created_at: now, updated_at: now,
      }));
    };
    grant('ceo', ['read']);
    grant('manager', ['read']);
    grant('team_lead', ['read']);
    if (rows.length) await queryInterface.bulkInsert('role_permissions', rows);
  },
};

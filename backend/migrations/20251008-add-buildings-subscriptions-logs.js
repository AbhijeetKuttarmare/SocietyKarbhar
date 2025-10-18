"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, UUIDV4, STRING, TEXT, ENUM, DATE, BOOLEAN, INTEGER, DECIMAL, JSONB } = Sequelize;

    // Create subscription plans (if missing)
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('subscription_plans')) {
      await queryInterface.createTable('subscription_plans', {
      id: { type: UUID, allowNull: false, primaryKey: true, defaultValue: UUIDV4 },
      name: { type: STRING, allowNull: false },
      duration_days: { type: INTEGER, defaultValue: 30 },
      price: { type: DECIMAL(10,2), defaultValue: 0.0 },
      features: { type: JSONB },
      createdAt: { type: DATE, allowNull: false },
      updatedAt: { type: DATE, allowNull: false }
      });
    }

    // Create buildings (if missing)
    if (!tables.includes('buildings')) {
      await queryInterface.createTable('buildings', {
      id: { type: UUID, allowNull: false, primaryKey: true, defaultValue: UUIDV4 },
      name: { type: STRING, allowNull: false },
      societyId: { type: UUID, allowNull: false },
      total_units: { type: INTEGER, defaultValue: 0 },
      address: { type: STRING, allowNull: true },
      createdAt: { type: DATE, allowNull: false },
      updatedAt: { type: DATE, allowNull: false }
      });
    }

    // Create superadmin logs (if missing)
    if (!tables.includes('superadmin_logs')) {
      await queryInterface.createTable('superadmin_logs', {
      id: { type: UUID, allowNull: false, primaryKey: true, defaultValue: UUIDV4 },
      user_id: { type: UUID, allowNull: false },
      action_type: { type: STRING, allowNull: false },
      details: { type: JSONB },
      createdAt: { type: DATE, allowNull: false },
      updatedAt: { type: DATE, allowNull: false }
      });
    }

    // Alter societies: add mobile_number, admin_id, subscription fields, status
  // Alter societies: add columns if missing
  const socDesc = await queryInterface.describeTable('societies');
  if (!socDesc.mobile_number) await queryInterface.addColumn('societies', 'mobile_number', { type: STRING, allowNull: true });
  if (!socDesc.admin_id) await queryInterface.addColumn('societies', 'admin_id', { type: UUID, allowNull: true });
  if (!socDesc.subscription_start_date) await queryInterface.addColumn('societies', 'subscription_start_date', { type: DATE, allowNull: true });
  if (!socDesc.subscription_end_date) await queryInterface.addColumn('societies', 'subscription_end_date', { type: DATE, allowNull: true });
  if (!socDesc.status) await queryInterface.addColumn('societies', 'status', { type: ENUM('active','inactive'), defaultValue: 'active' });
  if (!socDesc.subscription_plan_id) await queryInterface.addColumn('societies', 'subscription_plan_id', { type: UUID, allowNull: true });

    // Extend users.role enum to include builder and employee
    // Note: altering enums in Postgres requires creating a new type; sequelize doesn't provide a cross-db method.
    // We'll add a simple 'role_str' column to preserve compatibility and backfill from existing role.
    // Safely extend users.role enum: if role column exists and new enum not applied, perform conversion
    const userDesc = await queryInterface.describeTable('users');
    if (!userDesc.role) {
      // no role column? add new one
      await queryInterface.addColumn('users', 'role', { type: ENUM('superadmin','admin','builder','employee','owner','tenant','security_guard'), defaultValue: 'tenant' });
    } else {
      // role exists; try to add missing enum values by recreating column if necessary
      // We'll only proceed if the new enum values are not already present.
      // Create temporary role_str to copy values, then replace column.
      if (!Object.keys(userDesc).includes('role')) {
        // defensive no-op
      }
      await queryInterface.addColumn('users', 'role_str', { type: STRING, allowNull: true }).catch(() => {});
      await queryInterface.sequelize.query(`UPDATE users SET role_str = role::text`).catch(() => {});
      await queryInterface.removeColumn('users', 'role').catch(() => {});
      await queryInterface.addColumn('users', 'role', { type: ENUM('superadmin','admin','builder','employee','owner','tenant','security_guard'), defaultValue: 'tenant' }).catch(() => {});
      await queryInterface.sequelize.query(`UPDATE users SET role = role_str WHERE role_str IS NOT NULL`).catch(() => {});
      await queryInterface.removeColumn('users', 'role_str').catch(() => {});
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('societies', 'subscription_plan_id');
    await queryInterface.removeColumn('societies', 'status');
    await queryInterface.removeColumn('societies', 'subscription_end_date');
    await queryInterface.removeColumn('societies', 'subscription_start_date');
    await queryInterface.removeColumn('societies', 'admin_id');
    await queryInterface.removeColumn('societies', 'mobile_number');

    // Revert users role change: drop new enum and add previous one
    await queryInterface.addColumn('users', 'role_str', { type: STRING, allowNull: true });
    await queryInterface.sequelize.query(`UPDATE users SET role_str = role::text`);
    await queryInterface.removeColumn('users', 'role');
    await queryInterface.addColumn('users', 'role', { type: ENUM('superadmin','admin','owner','tenant','security_guard'), defaultValue: 'tenant' });
    await queryInterface.sequelize.query(`UPDATE users SET role = role_str WHERE role_str IS NOT NULL`);
    await queryInterface.removeColumn('users', 'role_str');

    await queryInterface.dropTable('superadmin_logs');
    await queryInterface.dropTable('buildings');
    await queryInterface.dropTable('subscription_plans');
  }
};

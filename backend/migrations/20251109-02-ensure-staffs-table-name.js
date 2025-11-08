'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { INTEGER, STRING, DATE } = Sequelize;
    // If a table named 'Staffs' already exists, do nothing.
    try {
      await queryInterface.describeTable('Staffs');
      return;
    } catch (e) {
      // not found, continue
    }

    // If a lowercase 'staffs' table exists (created by earlier migration), rename it to 'Staffs'
    try {
      await queryInterface.describeTable('staffs');
      await queryInterface.renameTable('staffs', 'Staffs');
      return;
    } catch (e) {
      // not found, continue to create
    }

    // Create the correctly named table
    await queryInterface.createTable('Staffs', {
      id: { type: INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
      name: { type: STRING, allowNull: false },
      staffType: { type: STRING, allowNull: true },
      phone: { type: STRING, allowNull: true },
      wingId: { type: STRING, allowNull: true },
      status: { type: STRING, allowNull: false, defaultValue: 'active' },
      societyId: { type: INTEGER, allowNull: true },
      createdAt: { type: DATE, allowNull: false },
      updatedAt: { type: DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    // Try to drop 'Staffs' if it exists
    try {
      await queryInterface.dropTable('Staffs');
    } catch (e) {
      // ignore
    }
  },
};

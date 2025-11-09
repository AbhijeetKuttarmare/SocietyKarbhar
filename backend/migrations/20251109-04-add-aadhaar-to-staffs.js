'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Support environments where the table was created as 'staffs' or 'Staffs'
    const candidates = ['staffs', 'Staffs'];
    for (const tableName of candidates) {
      try {
        // If table exists, add the column and exit
        await queryInterface.describeTable(tableName);
        await queryInterface.addColumn(tableName, 'aadhaarUrl', {
          type: Sequelize.TEXT,
          allowNull: true,
        });
        return;
      } catch (e) {
        // table not found — try next candidate
      }
    }
    // If we reach here neither table exists — surface a helpful error
    throw new Error("Cannot add aadhaarUrl: neither 'staffs' nor 'Staffs' table exists");
  },

  async down(queryInterface) {
    const candidates = ['staffs', 'Staffs'];
    for (const tableName of candidates) {
      try {
        await queryInterface.describeTable(tableName);
        await queryInterface.removeColumn(tableName, 'aadhaarUrl');
        return;
      } catch (e) {
        // not found — continue
      }
    }
    // nothing to remove
  },
};

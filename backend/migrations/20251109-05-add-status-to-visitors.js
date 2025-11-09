'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // add status and checkoutTime to visitors table if missing
    const candidates = ['visitors', 'Visitors'];
    for (const tableName of candidates) {
      try {
        await queryInterface.describeTable(tableName);
        // add status
        try {
          await queryInterface.addColumn(tableName, 'status', {
            type: Sequelize.STRING,
            allowNull: true,
          });
        } catch (e) {}
        // add checkoutTime
        try {
          await queryInterface.addColumn(tableName, 'checkoutTime', {
            type: Sequelize.DATE,
            allowNull: true,
          });
        } catch (e) {}
        return;
      } catch (e) {
        // table not found, try next candidate
      }
    }
    throw new Error('Cannot add status/checkoutTime: visitors table not found');
  },

  async down(queryInterface) {
    const candidates = ['visitors', 'Visitors'];
    for (const tableName of candidates) {
      try {
        await queryInterface.describeTable(tableName);
        try {
          await queryInterface.removeColumn(tableName, 'status');
        } catch (e) {}
        try {
          await queryInterface.removeColumn(tableName, 'checkoutTime');
        } catch (e) {}
        return;
      } catch (e) {}
    }
  },
};

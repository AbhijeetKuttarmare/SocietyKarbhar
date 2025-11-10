'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const candidates = ['visitors', 'Visitors'];
    for (const tableName of candidates) {
      try {
        await queryInterface.describeTable(tableName);
        try {
          await queryInterface.addColumn(tableName, 'societyId', {
            type: Sequelize.UUID,
            allowNull: true,
          });
        } catch (e) {
          // ignore if already exists
        }
        return;
      } catch (e) {
        // table missing, try next candidate
      }
    }
    throw new Error('Cannot add societyId: visitors table not found');
  },

  async down(queryInterface) {
    const candidates = ['visitors', 'Visitors'];
    for (const tableName of candidates) {
      try {
        await queryInterface.describeTable(tableName);
        try {
          await queryInterface.removeColumn(tableName, 'societyId');
        } catch (e) {}
        return;
      } catch (e) {}
    }
  },
};

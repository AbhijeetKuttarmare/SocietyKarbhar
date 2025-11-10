'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Try both common table name variants to be robust across environments
    const candidates = ['Visitors', 'visitors'];
    for (const tableName of candidates) {
      try {
        // describeTable will throw if table doesn't exist
        await queryInterface.describeTable(tableName);
        // Add societyId if missing
        try {
          await queryInterface.addColumn(tableName, 'societyId', {
            type: Sequelize.UUID,
            allowNull: true,
          });
        } catch (e) {
          // ignore if column exists or cannot be added
        }
        return;
      } catch (e) {
        // table not present with this name — try next candidate
      }
    }
    throw new Error('Cannot add societyId: visitors table not found');
  },

  async down(queryInterface) {
    const candidates = ['Visitors', 'visitors'];
    for (const tableName of candidates) {
      try {
        await queryInterface.describeTable(tableName);
        try {
          await queryInterface.removeColumn(tableName, 'societyId');
        } catch (e) {
          // ignore
        }
        return;
      } catch (e) {
        // table not found, try next
      }
    }
  },
};

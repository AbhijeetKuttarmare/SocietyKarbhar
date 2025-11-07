/* eslint-disable no-unused-vars */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Make migration idempotent: only add column if it does not already exist
    const table = await queryInterface.describeTable('users');
    if (!table.societyId) {
      await queryInterface.addColumn('users', 'societyId', {
        type: Sequelize.UUID,
        allowNull: true,
      });
    }
  },
  down: async (queryInterface) => {
    // Remove column only if it exists
    const table = await queryInterface.describeTable('users');
    if (table.societyId) {
      await queryInterface.removeColumn('users', 'societyId');
    }
  },
};

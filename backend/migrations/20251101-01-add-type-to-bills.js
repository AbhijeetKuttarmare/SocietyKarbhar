'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add `type` column to bills if it doesn't exist
    const table = await queryInterface.describeTable('bills');
    if (!table.type) {
      await queryInterface.addColumn('bills', 'type', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'other',
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('bills');
    if (table.type) {
      await queryInterface.removeColumn('bills', 'type');
    }
  },
};

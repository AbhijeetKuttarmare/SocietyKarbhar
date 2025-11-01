'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add `type` column to bills if it doesn't exist
    try {
      await queryInterface.addColumn('bills', 'type', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'other',
      });
    } catch (e) {
      // If column already exists or table missing, fail gracefully with a warning
      console.warn('add-type-to-bills migration warning:', e && e.message);
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeColumn('bills', 'type');
    } catch (e) {
      console.warn('remove type column failed', e && e.message);
    }
  },
};

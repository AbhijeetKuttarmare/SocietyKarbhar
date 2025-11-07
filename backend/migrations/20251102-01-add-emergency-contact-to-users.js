'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('users');
    if (!table.emergency_contact) {
      await queryInterface.addColumn('users', 'emergency_contact', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('users');
    if (table.emergency_contact) {
      await queryInterface.removeColumn('users', 'emergency_contact');
    }
  },
};

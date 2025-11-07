'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('societies');
    if (!table.mobile_number) {
      await queryInterface.addColumn('societies', 'mobile_number', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('societies');
    if (table.mobile_number) {
      await queryInterface.removeColumn('societies', 'mobile_number');
    }
  },
};

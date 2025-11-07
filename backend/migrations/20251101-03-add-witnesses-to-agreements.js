/* eslint-disable no-unused-vars */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // add witness1 and witness2 to agreements
    const table = await queryInterface.describeTable('agreements');
    if (!table.witness1) {
      await queryInterface.addColumn('agreements', 'witness1', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    if (!table.witness2) {
      await queryInterface.addColumn('agreements', 'witness2', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('agreements');
    if (table.witness1) await queryInterface.removeColumn('agreements', 'witness1');
    if (table.witness2) await queryInterface.removeColumn('agreements', 'witness2');
  },
};

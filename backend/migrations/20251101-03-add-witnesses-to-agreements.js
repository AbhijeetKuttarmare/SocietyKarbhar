/* eslint-disable no-unused-vars */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // add witness1 and witness2 to agreements
    await queryInterface.addColumn('agreements', 'witness1', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('agreements', 'witness2', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('agreements', 'witness1');
    await queryInterface.removeColumn('agreements', 'witness2');
  },
};

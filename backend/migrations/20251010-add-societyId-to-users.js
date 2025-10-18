/* eslint-disable no-unused-vars */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'societyId', { type: Sequelize.UUID, allowNull: true });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('users', 'societyId');
  }
};

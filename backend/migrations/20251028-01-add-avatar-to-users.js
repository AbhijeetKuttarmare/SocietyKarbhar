'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { STRING } = Sequelize;
    const table = await queryInterface.describeTable('users');
    if (!table.avatar) {
      await queryInterface.addColumn('users', 'avatar', { type: STRING, allowNull: true });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('users');
    if (table.avatar) {
      await queryInterface.removeColumn('users', 'avatar');
    }
  },
};

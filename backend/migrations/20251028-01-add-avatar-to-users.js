'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { STRING } = Sequelize;
    await queryInterface.addColumn('users', 'avatar', { type: STRING, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'avatar');
  },
};

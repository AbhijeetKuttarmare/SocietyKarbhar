"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID } = Sequelize;
    await queryInterface.addColumn('flats', 'buildingId', { type: UUID, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('flats', 'buildingId');
  }
};

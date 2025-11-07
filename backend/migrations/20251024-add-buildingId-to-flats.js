"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID } = Sequelize;
    const table = await queryInterface.describeTable('flats');
    if (!table.buildingId) {
      await queryInterface.addColumn('flats', 'buildingId', { type: UUID, allowNull: true });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('flats');
    if (table.buildingId) {
      await queryInterface.removeColumn('flats', 'buildingId');
    }
  }
};

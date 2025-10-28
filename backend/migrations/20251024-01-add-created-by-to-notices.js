"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID } = Sequelize;
    // Add created_by column to notices if it doesn't exist
    await queryInterface.addColumn('notices', 'created_by', { type: UUID, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('notices', 'created_by');
  }
};

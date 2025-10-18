"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, UUIDV4, STRING, DATE } = Sequelize;
    await queryInterface.createTable('flats', {
      id: { type: UUID, allowNull: false, primaryKey: true, defaultValue: UUIDV4 },
      societyId: { type: UUID },
      flat_no: { type: STRING },
      ownerId: { type: UUID },
      createdAt: { type: DATE, allowNull: false },
      updatedAt: { type: DATE, allowNull: false }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('flats');
  }
};

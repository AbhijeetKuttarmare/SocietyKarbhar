"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, UUIDV4, STRING, DATE } = Sequelize;
    await queryInterface.createTable('societies', {
      id: { type: UUID, allowNull: false, primaryKey: true, defaultValue: UUIDV4 },
      name: { type: STRING, allowNull: false },
      country: { type: STRING },
      city: { type: STRING },
      area: { type: STRING },
      created_by: { type: UUID, allowNull: true },
      createdAt: { type: DATE, allowNull: false },
      updatedAt: { type: DATE, allowNull: false }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('societies');
  }
};

"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, UUIDV4, STRING, TEXT, DATE } = Sequelize;
    await queryInterface.createTable('helplines', {
      id: { type: UUID, allowNull: false, primaryKey: true, defaultValue: UUIDV4 },
      societyId: { type: UUID, allowNull: false },
      type: { type: STRING, allowNull: false },
      name: { type: STRING },
      phone: { type: STRING, allowNull: false },
      notes: { type: TEXT },
      createdAt: { type: DATE, allowNull: false },
      updatedAt: { type: DATE, allowNull: false }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('helplines');
  }
};

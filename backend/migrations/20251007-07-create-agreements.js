"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, UUIDV4, DATE, TEXT } = Sequelize;
    await queryInterface.createTable('agreements', {
      id: { type: UUID, allowNull: false, primaryKey: true, defaultValue: UUIDV4 },
      flatId: { type: UUID },
      ownerId: { type: UUID },
      tenantId: { type: UUID },
      file_url: { type: TEXT },
      start_date: { type: DATE },
      end_date: { type: DATE },
      createdAt: { type: DATE, allowNull: false },
      updatedAt: { type: DATE, allowNull: false }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('agreements');
  }
};

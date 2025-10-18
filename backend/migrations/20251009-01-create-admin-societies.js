"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, UUIDV4, DATE } = Sequelize;
    await queryInterface.createTable('admin_societies', {
      id: { type: UUID, allowNull: false, primaryKey: true, defaultValue: UUIDV4 },
      userId: { type: UUID, allowNull: false },
      societyId: { type: UUID, allowNull: false },
      createdAt: { type: DATE, allowNull: false },
      updatedAt: { type: DATE, allowNull: false }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('admin_societies');
  }
};

"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, UUIDV4, STRING, DATE, BOOLEAN } = Sequelize;
    await queryInterface.createTable('otps', {
      id: { type: UUID, allowNull: false, primaryKey: true, defaultValue: UUIDV4 },
      phone: { type: STRING, allowNull: false },
      code: { type: STRING, allowNull: false },
      expires_at: { type: DATE, allowNull: false },
      used: { type: BOOLEAN, defaultValue: false },
      createdAt: { type: DATE, allowNull: false },
      updatedAt: { type: DATE, allowNull: false }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('otps');
  }
};

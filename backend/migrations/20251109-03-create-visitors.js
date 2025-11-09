'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, UUIDV4, STRING, DATE, INTEGER, JSON, TEXT } = Sequelize;
    await queryInterface.createTable('visitors', {
      id: { type: UUID, allowNull: false, primaryKey: true, defaultValue: UUIDV4 },
      mainVisitorName: { type: STRING },
      selfie: { type: TEXT },
      flatId: { type: UUID },
      wingId: { type: UUID },
      reason: { type: TEXT },
      numberOfPeople: { type: INTEGER },
      additionalVisitors: { type: JSON },
      checkInTime: { type: DATE },
      visitorIdGenerated: { type: STRING },
      gateId: { type: STRING },
      createdAt: { type: DATE, allowNull: false },
      updatedAt: { type: DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('visitors');
  },
};

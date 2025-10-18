"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, UUIDV4, STRING, TEXT, DATE, ENUM } = Sequelize;
    await queryInterface.createTable('complaints', {
      id: { type: UUID, allowNull: false, primaryKey: true, defaultValue: UUIDV4 },
      title: { type: STRING },
      description: { type: TEXT },
      status: { type: ENUM('open','in_progress','resolved','closed'), defaultValue: 'open' },
      societyId: { type: UUID },
      raised_by: { type: UUID },
      assigned_to: { type: UUID },
      createdAt: { type: DATE, allowNull: false },
      updatedAt: { type: DATE, allowNull: false }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('complaints');
  }
};

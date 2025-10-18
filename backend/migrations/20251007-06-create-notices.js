"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, UUIDV4, STRING, TEXT, DATE } = Sequelize;
    await queryInterface.createTable('notices', {
      id: { type: UUID, allowNull: false, primaryKey: true, defaultValue: UUIDV4 },
      title: { type: STRING },
      description: { type: TEXT },
      image_url: { type: TEXT },
      societyId: { type: UUID },
      created_by: { type: UUID },
      createdAt: { type: DATE, allowNull: false },
      updatedAt: { type: DATE, allowNull: false }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notices');
  }
};

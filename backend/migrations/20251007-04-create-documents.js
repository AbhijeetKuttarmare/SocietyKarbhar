"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, UUIDV4, STRING, TEXT, DATE } = Sequelize;
    await queryInterface.createTable('documents', {
      id: { type: UUID, allowNull: false, primaryKey: true, defaultValue: UUIDV4 },
      title: { type: STRING },
      file_url: { type: TEXT },
      file_type: { type: STRING },
      societyId: { type: UUID },
      uploaded_by: { type: UUID },
      createdAt: { type: DATE, allowNull: false },
      updatedAt: { type: DATE, allowNull: false }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('documents');
  }
};

'use strict';

"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, UUIDV4, DATE } = Sequelize;
    await queryInterface.createTable('notice_recipients', {
      id: { type: UUID, allowNull: false, primaryKey: true, defaultValue: UUIDV4 },
      noticeId: { type: UUID, allowNull: false },
      userId: { type: UUID, allowNull: false },
      societyId: { type: UUID, allowNull: true },
      readAt: { type: DATE, allowNull: true },
      createdAt: { type: DATE, allowNull: false },
      updatedAt: { type: DATE, allowNull: false }
    });
    await queryInterface.addIndex('notice_recipients', ['noticeId']);
    await queryInterface.addIndex('notice_recipients', ['userId']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notice_recipients');
  }
};

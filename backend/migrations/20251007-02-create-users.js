"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, UUIDV4, STRING, ENUM, DATE } = Sequelize;
    await queryInterface.createTable('users', {
      id: { type: UUID, allowNull: false, primaryKey: true, defaultValue: UUIDV4 },
      name: { type: STRING },
      phone: { type: STRING, unique: true },
      email: { type: STRING, unique: true, allowNull: true },
      role: { type: ENUM('superadmin','admin','owner','tenant','security_guard'), defaultValue: 'tenant' },
      password_hash: { type: STRING, allowNull: true },
      societyId: { type: UUID, allowNull: true },
      flat_no: { type: STRING, allowNull: true },
      createdAt: { type: DATE, allowNull: false },
      updatedAt: { type: DATE, allowNull: false }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('users');
  }
};

"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, UUIDV4, STRING, TEXT, ENUM, DATE, BOOLEAN } = Sequelize;

    await queryInterface.createTable('societies', {
      id: { type: UUID, allowNull: false, primaryKey: true, defaultValue: UUIDV4 },
      name: { type: STRING, allowNull: false },
      country: { type: STRING },
      city: { type: STRING },
      area: { type: STRING },
      created_by: { type: UUID, allowNull: true },
      createdAt: { type: DATE, allowNull: false },
      updatedAt: { type: DATE, allowNull: false }
    });

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

    await queryInterface.createTable('flats', {
      id: { type: UUID, allowNull: false, primaryKey: true, defaultValue: UUIDV4 },
      societyId: { type: UUID },
      flat_no: { type: STRING },
      ownerId: { type: UUID },
      createdAt: { type: DATE, allowNull: false },
      updatedAt: { type: DATE, allowNull: false }
    });

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

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('otps');
    await queryInterface.dropTable('agreements');
    await queryInterface.dropTable('notices');
    await queryInterface.dropTable('complaints');
    await queryInterface.dropTable('documents');
    await queryInterface.dropTable('flats');
    await queryInterface.dropTable('users');
    await queryInterface.dropTable('societies');
  }
};

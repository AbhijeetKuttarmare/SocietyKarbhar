'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { INTEGER, STRING, DATE } = Sequelize;
    await queryInterface.createTable('staffs', {
      id: { type: INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
      name: { type: STRING, allowNull: false },
      staffType: { type: STRING, allowNull: true },
      phone: { type: STRING, allowNull: true },
      wingId: { type: STRING, allowNull: true },
      status: { type: STRING, allowNull: false, defaultValue: 'active' },
      societyId: { type: INTEGER, allowNull: true },
      createdAt: { type: DATE, allowNull: false },
      updatedAt: { type: DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('staffs');
  },
};

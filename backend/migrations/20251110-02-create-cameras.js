'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { INTEGER, STRING, TEXT, BOOLEAN, DATE } = Sequelize;
    await queryInterface.createTable('cameras', {
      id: { type: INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
      societyId: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      name: { type: STRING, allowNull: false },
      ip_address: { type: STRING, allowNull: false },
      port: { type: INTEGER, allowNull: false, defaultValue: 554 },
      username: { type: STRING, allowNull: false },
      password: { type: TEXT, allowNull: false },
      rtsp_path: {
        type: STRING,
        allowNull: false,
        defaultValue: 'cam/realmonitor?channel=1&subtype=0',
      },
      is_active: { type: BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: DATE, allowNull: false },
      updatedAt: { type: DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('cameras');
  },
};

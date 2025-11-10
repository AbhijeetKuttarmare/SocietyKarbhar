'use strict';

module.exports = (sequelize) => {
  const { DataTypes } = require('sequelize');
  const Camera = sequelize.define(
    'Camera',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      societyId: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      ip_address: { type: DataTypes.STRING, allowNull: false },
      port: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 554 },
      username: { type: DataTypes.STRING, allowNull: false },
      password: { type: DataTypes.TEXT, allowNull: false },
      rtsp_path: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'cam/realmonitor?channel=1&subtype=0',
      },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: 'cameras',
    }
  );

  return Camera;
};

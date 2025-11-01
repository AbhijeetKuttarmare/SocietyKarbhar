module.exports = (sequelize) => {
  const { DataTypes } = require('sequelize');
  const MaintenanceSetting = sequelize.define(
    'MaintenanceSetting',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      societyId: { type: DataTypes.UUID, allowNull: false },
      amount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      // optional effective_from to allow future settings
      effective_from: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: 'maintenance_settings', underscored: true }
  );

  return MaintenanceSetting;
};

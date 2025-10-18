const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const Building = sequelize.define('Building', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    societyId: { type: DataTypes.UUID, allowNull: false },
    total_units: { type: DataTypes.INTEGER, defaultValue: 0 },
    address: { type: DataTypes.STRING, allowNull: true }
  }, { tableName: 'buildings' });

  return Building;
};

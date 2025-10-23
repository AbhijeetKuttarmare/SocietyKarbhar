const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const Flat = sequelize.define('Flat', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    societyId: { type: DataTypes.UUID },
    flat_no: { type: DataTypes.STRING },
    ownerId: { type: DataTypes.UUID },
    buildingId: { type: DataTypes.UUID }
  }, { tableName: 'flats' });

  return Flat;
};

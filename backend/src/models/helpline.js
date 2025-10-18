const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const Helpline = sequelize.define('Helpline', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    societyId: { type: DataTypes.UUID, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING },
    phone: { type: DataTypes.STRING, allowNull: false },
    notes: { type: DataTypes.TEXT }
  }, { tableName: 'helplines' });

  return Helpline;
};

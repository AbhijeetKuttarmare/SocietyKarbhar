const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const OTP = sequelize.define('OTP', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    phone: { type: DataTypes.STRING, allowNull: false },
    code: { type: DataTypes.STRING, allowNull: false },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    used: { type: DataTypes.BOOLEAN, defaultValue: false }
  }, { tableName: 'otps' });

  return OTP;
};

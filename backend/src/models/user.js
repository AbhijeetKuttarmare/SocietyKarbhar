const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: () => uuidv4(),
      primaryKey: true
    },
    societyId: { type: DataTypes.UUID, allowNull: true },
    name: { type: DataTypes.STRING },
    phone: { type: DataTypes.STRING, unique: true },
    email: { type: DataTypes.STRING, unique: true, allowNull: true },
    role: { type: DataTypes.ENUM('superadmin','admin','owner','tenant', 'resident','security_guard'), defaultValue: 'tenant' },
    password_hash: { type: DataTypes.STRING, allowNull: true }
  }, { tableName: 'users' });

  return User;
};

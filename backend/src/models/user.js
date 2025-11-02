const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const User = sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
      },
      societyId: { type: DataTypes.UUID, allowNull: true },
      name: { type: DataTypes.STRING },
      phone: { type: DataTypes.STRING, unique: true },
      email: { type: DataTypes.STRING, unique: true, allowNull: true },
      role: {
        type: DataTypes.ENUM(
          'superadmin',
          'admin',
          'owner',
          'tenant',
          'resident',
          'security_guard'
        ),
        defaultValue: 'tenant',
      },
      password_hash: { type: DataTypes.STRING, allowNull: true },
      // tenant/owner profile fields
      address: { type: DataTypes.STRING, allowNull: true },
      emergency_contact: { type: DataTypes.STRING, allowNull: true },
      avatar: { type: DataTypes.STRING, allowNull: true },
      gender: { type: DataTypes.ENUM('male', 'female', 'other'), allowNull: true },
      move_in: { type: DataTypes.DATE, allowNull: true },
      move_out: { type: DataTypes.DATE, allowNull: true },
      rent: { type: DataTypes.INTEGER, allowNull: true },
      deposit: { type: DataTypes.INTEGER, allowNull: true },
      status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' },
    },
    { tableName: 'users' }
  );

  return User;
};

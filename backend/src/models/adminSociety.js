const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const AdminSociety = sequelize.define('AdminSociety', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    societyId: { type: DataTypes.UUID, allowNull: false }
  }, { tableName: 'admin_societies' });

  return AdminSociety;
};

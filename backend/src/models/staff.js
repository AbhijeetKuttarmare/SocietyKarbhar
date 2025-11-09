module.exports = (sequelize) => {
  const { DataTypes } = require('sequelize');
  const Staff = sequelize.define(
    'Staff',
    {
      name: { type: DataTypes.STRING, allowNull: false },
      staffType: { type: DataTypes.STRING, allowNull: true },
      phone: { type: DataTypes.STRING, allowNull: true },
      wingId: { type: DataTypes.STRING, allowNull: true },
      aadhaarUrl: { type: DataTypes.TEXT, allowNull: true },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' },
      societyId: { type: DataTypes.UUID, allowNull: true },
    },
    {
      // keep table name pluralization consistent with other models
      // and allow Sequelize to map to the `Staffs` table (or fallback)
    }
  );
  return Staff;
};

const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const Society = sequelize.define(
    'Society',
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false },
      builder_name: { type: DataTypes.STRING, allowNull: true },
      mobile_number: { type: DataTypes.STRING },
      image_url: { type: DataTypes.TEXT },
      country: { type: DataTypes.STRING },
      city: { type: DataTypes.STRING },
      area: { type: DataTypes.STRING },
      created_by: { type: DataTypes.UUID },
    },
    { tableName: 'societies' }
  );

  return Society;
};

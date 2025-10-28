const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const Notice = sequelize.define('Notice', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    title: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    image_url: { type: DataTypes.TEXT },
    societyId: { type: DataTypes.UUID },
    created_by: { type: DataTypes.UUID }
  }, { tableName: 'notices' });

  return Notice;
};

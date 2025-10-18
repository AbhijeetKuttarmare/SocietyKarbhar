const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const Agreement = sequelize.define('Agreement', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    flatId: { type: DataTypes.UUID },
    ownerId: { type: DataTypes.UUID },
    tenantId: { type: DataTypes.UUID },
    file_url: { type: DataTypes.TEXT },
    start_date: { type: DataTypes.DATE },
    end_date: { type: DataTypes.DATE }
  }, { tableName: 'agreements' });

  return Agreement;
};

const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const Document = sequelize.define('Document', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    title: { type: DataTypes.STRING },
    file_url: { type: DataTypes.TEXT },
    file_type: { type: DataTypes.STRING },
    societyId: { type: DataTypes.UUID },
    uploaded_by: { type: DataTypes.UUID }
  }, { tableName: 'documents' });

  return Document;
};

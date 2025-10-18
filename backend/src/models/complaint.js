const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const Complaint = sequelize.define('Complaint', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    title: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    status: { type: DataTypes.ENUM('open','in_progress','resolved','closed'), defaultValue: 'open' },
    societyId: { type: DataTypes.UUID },
    raised_by: { type: DataTypes.UUID },
    assigned_to: { type: DataTypes.UUID }
  }, { tableName: 'complaints' });

  return Complaint;
};

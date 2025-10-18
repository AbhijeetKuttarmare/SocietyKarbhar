const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const SuperadminLog = sequelize.define('SuperadminLog', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    action_type: { type: DataTypes.STRING, allowNull: false },
    details: { type: DataTypes.JSONB, allowNull: true }
  }, { tableName: 'superadmin_logs' });

  return SuperadminLog;
};

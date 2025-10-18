const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const SubscriptionPlan = sequelize.define('SubscriptionPlan', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    duration_days: { type: DataTypes.INTEGER, defaultValue: 30 },
    price: { type: DataTypes.DECIMAL(10,2), defaultValue: 0.0 },
    features: { type: DataTypes.JSONB, allowNull: true }
  }, { tableName: 'subscription_plans' });

  return SubscriptionPlan;
};

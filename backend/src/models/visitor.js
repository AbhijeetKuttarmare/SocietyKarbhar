module.exports = (sequelize) => {
  const { DataTypes } = require('sequelize');
  const Visitor = sequelize.define(
    'Visitor',
    {
      mainVisitorName: { type: DataTypes.STRING, allowNull: true },
      selfie: { type: DataTypes.TEXT, allowNull: true },
      flatId: { type: DataTypes.UUID, allowNull: true },
      wingId: { type: DataTypes.UUID, allowNull: true },
      reason: { type: DataTypes.TEXT, allowNull: true },
      numberOfPeople: { type: DataTypes.INTEGER, allowNull: true },
      additionalVisitors: { type: DataTypes.JSON, allowNull: true },
      // status: 'IN' | 'OUT' etc. Added to track active visitors
      status: { type: DataTypes.STRING, allowNull: true },
      // checkoutTime records when visitor left
      checkoutTime: { type: DataTypes.DATE, allowNull: true },
      checkInTime: { type: DataTypes.DATE, allowNull: true },
      visitorIdGenerated: { type: DataTypes.STRING, allowNull: true },
      gateId: { type: DataTypes.STRING, allowNull: true },
    },
    {
      // tableName will default to pluralized form 'Visitors'
    }
  );

  return Visitor;
};

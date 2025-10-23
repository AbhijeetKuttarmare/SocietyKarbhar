const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const NoticeRecipient = sequelize.define('NoticeRecipient', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    noticeId: { type: DataTypes.UUID },
    userId: { type: DataTypes.UUID },
    societyId: { type: DataTypes.UUID },
    readAt: { type: DataTypes.DATE }
  }, { tableName: 'notice_recipients' });

  return NoticeRecipient;
};

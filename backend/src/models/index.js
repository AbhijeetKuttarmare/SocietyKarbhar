const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  dialect: 'postgres',
  logging: false
});

const db = { sequelize, Sequelize };

db.User = require('./user')(sequelize);
db.Society = require('./society')(sequelize);
db.Flat = require('./flat')(sequelize);
db.Document = require('./document')(sequelize);
db.Complaint = require('./complaint')(sequelize);
db.Notice = require('./notice')(sequelize);
db.Agreement = require('./agreement')(sequelize);
db.OTP = require('./otp')(sequelize);
db.Building = require('./building')(sequelize);
db.SubscriptionPlan = require('./subscriptionPlan')(sequelize);
db.SuperadminLog = require('./superadminLog')(sequelize);
db.AdminSociety = require('./adminSociety')(sequelize);
db.Helpline = require('./helpline')(sequelize);

// Associations
db.Society.hasMany(db.Flat, { foreignKey: 'societyId' });
db.Flat.belongsTo(db.Society, { foreignKey: 'societyId' });

db.User.hasMany(db.Flat, { foreignKey: 'ownerId' });
db.Flat.belongsTo(db.User, { foreignKey: 'ownerId', as: 'owner' });

db.Society.hasMany(db.Document, { foreignKey: 'societyId' });
db.Document.belongsTo(db.Society, { foreignKey: 'societyId' });

db.Society.hasMany(db.Building, { foreignKey: 'societyId' });
db.Building.belongsTo(db.Society, { foreignKey: 'societyId' });

db.Society.belongsTo(db.User, { foreignKey: 'admin_id', as: 'admin' });

db.SubscriptionPlan.hasMany(db.Society, { foreignKey: 'subscription_plan_id' });
db.Society.belongsTo(db.SubscriptionPlan, { foreignKey: 'subscription_plan_id' });

// Many-to-many: admins can belong to multiple societies
db.User.belongsToMany(db.Society, { through: db.AdminSociety, foreignKey: 'userId', as: 'adminSocieties' });
db.Society.belongsToMany(db.User, { through: db.AdminSociety, foreignKey: 'societyId', as: 'admins' });

db.Society.hasMany(db.Complaint, { foreignKey: 'societyId' });
db.Complaint.belongsTo(db.Society, { foreignKey: 'societyId' });

db.Society.hasMany(db.Notice, { foreignKey: 'societyId' });
db.Notice.belongsTo(db.Society, { foreignKey: 'societyId' });

db.Society.hasMany(db.Helpline, { foreignKey: 'societyId' });
db.Helpline.belongsTo(db.Society, { foreignKey: 'societyId' });

// OTP has no associations currently

module.exports = db;

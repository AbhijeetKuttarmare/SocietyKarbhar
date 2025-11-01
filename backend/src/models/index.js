const { Sequelize } = require('sequelize');

let sequelize;
// If Postgres env vars are provided, use Postgres. Otherwise fall back to a local sqlite DB for dev.
if (process.env.DB_NAME && process.env.DB_USER) {
  sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
  });
} else {
  // sqlite fallback for local development/testing
  const storagePath = process.env.SQLITE_FILE || './tmp/dev.sqlite';
  sequelize = new Sequelize({ dialect: 'sqlite', storage: storagePath, logging: false });
  console.warn('[models] Using sqlite fallback for development:', storagePath);
}

const db = { sequelize, Sequelize };

db.User = require('./user')(sequelize);
db.Society = require('./society')(sequelize);
db.Flat = require('./flat')(sequelize);
db.Document = require('./document')(sequelize);
db.Complaint = require('./complaint')(sequelize);
db.Bill = require('./bill')(sequelize);
db.MaintenanceSetting = require('./maintenanceSetting')(sequelize);
db.Notice = require('./notice')(sequelize);
db.Agreement = require('./agreement')(sequelize);
db.OTP = require('./otp')(sequelize);
db.Building = require('./building')(sequelize);
db.NoticeRecipient = require('./noticeRecipient')(sequelize);
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

// Building <-> Flat association (each building/wing has many flats)
db.Building.hasMany(db.Flat, { foreignKey: 'buildingId' });
db.Flat.belongsTo(db.Building, { foreignKey: 'buildingId' });

db.Society.belongsTo(db.User, { foreignKey: 'admin_id', as: 'admin' });

db.SubscriptionPlan.hasMany(db.Society, { foreignKey: 'subscription_plan_id' });
db.Society.belongsTo(db.SubscriptionPlan, { foreignKey: 'subscription_plan_id' });

// Many-to-many: admins can belong to multiple societies
db.User.belongsToMany(db.Society, {
  through: db.AdminSociety,
  foreignKey: 'userId',
  as: 'adminSocieties',
});
db.Society.belongsToMany(db.User, {
  through: db.AdminSociety,
  foreignKey: 'societyId',
  as: 'admins',
});

db.Society.hasMany(db.Complaint, { foreignKey: 'societyId' });
db.Complaint.belongsTo(db.Society, { foreignKey: 'societyId' });

// Bills (owner-created bills) stored separately from complaints
db.Society.hasMany(db.Bill, { foreignKey: 'societyId' });
db.Bill.belongsTo(db.Society, { foreignKey: 'societyId' });

// Maintenance setting: one per society (optional)
db.Society.hasOne(db.MaintenanceSetting, { foreignKey: 'societyId' });
db.MaintenanceSetting.belongsTo(db.Society, { foreignKey: 'societyId' });

// Link bills to users for raised_by / assigned_to
db.User.hasMany(db.Bill, { foreignKey: 'raised_by', as: 'raisedBills' });
db.Bill.belongsTo(db.User, { foreignKey: 'raised_by', as: 'raiser' });
db.User.hasMany(db.Bill, { foreignKey: 'assigned_to', as: 'assignedBills' });
db.Bill.belongsTo(db.User, { foreignKey: 'assigned_to', as: 'assignee' });

db.Society.hasMany(db.Notice, { foreignKey: 'societyId' });
db.Notice.belongsTo(db.Society, { foreignKey: 'societyId' });
// notice recipients (per-user routing)
db.Notice.hasMany(db.NoticeRecipient, { foreignKey: 'noticeId' });
db.NoticeRecipient.belongsTo(db.Notice, { foreignKey: 'noticeId' });
db.User.hasMany(db.NoticeRecipient, { foreignKey: 'userId' });
db.NoticeRecipient.belongsTo(db.User, { foreignKey: 'userId' });

db.Society.hasMany(db.Helpline, { foreignKey: 'societyId' });
db.Helpline.belongsTo(db.Society, { foreignKey: 'societyId' });

// OTP has no associations currently

// Agreements: link agreements to flats and to users (owner/tenant)
db.Flat.hasMany(db.Agreement, { foreignKey: 'flatId' });
db.Agreement.belongsTo(db.Flat, { foreignKey: 'flatId' });

// Agreement <-> User associations for tenant and owner
db.User.hasMany(db.Agreement, { foreignKey: 'tenantId', as: 'tenantAgreements' });
db.Agreement.belongsTo(db.User, { foreignKey: 'tenantId', as: 'tenant' });

db.User.hasMany(db.Agreement, { foreignKey: 'ownerId', as: 'ownerAgreements' });
db.Agreement.belongsTo(db.User, { foreignKey: 'ownerId', as: 'owner' });

module.exports = db;

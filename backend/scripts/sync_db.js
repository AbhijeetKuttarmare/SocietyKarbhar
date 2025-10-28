const path = require('path');
// Load project's models which will initialize sequelize with the same config the app uses
const db = require('../src/models');

(async () => {
  try {
    await db.sequelize.authenticate();
    console.log('Authenticated to DB. Dialect:', db.sequelize.getDialect());
    if (db.sequelize.options && db.sequelize.options.storage) {
      console.log('SQLite storage path:', db.sequelize.options.storage);
    }
    // Use alter in dev to apply schema changes without destructive drops
    await db.sequelize.sync({ alter: true });
    console.log('Database sync (alter) completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Database sync failed:', err && err.message ? err.message : err);
    console.error(err);
    process.exit(1);
  }
})();

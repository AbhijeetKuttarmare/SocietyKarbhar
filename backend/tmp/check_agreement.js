const db = require('../src/models');

(async () => {
  try {
    await db.sequelize.authenticate();
    console.log('[check] connected to DB');
    const tenantId = '74a5a81f-a214-421c-9f52-362f31516347';
    const agreements = await db.Agreement.findAll({ where: { tenantId } });
    console.log('[check] agreements for tenant:', agreements.length);
    console.log(JSON.stringify(agreements.map((a) => a.get({ plain: true })), null, 2));
    const docs = await db.Document.findAll({ where: { uploaded_by: tenantId } });
    console.log('[check] documents uploaded_by tenant:', docs.length);
    console.log(JSON.stringify(docs.map((d) => d.get({ plain: true })), null, 2));
    process.exit(0);
  } catch (e) {
    console.error('[check] error', e && (e.stack || e.message));
    process.exit(1);
  }
})();

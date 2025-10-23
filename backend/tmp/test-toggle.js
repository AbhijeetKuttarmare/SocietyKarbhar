const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, Society } = require('../src/models');
const jwt = require('jsonwebtoken');

async function run(){
  try{
    await sequelize.sync({ force: true });
    console.log('DB synced (force)');
    const s = await Society.create({ name: 'Test Society' });
    const owner = await User.create({ name: 'Owner Test', phone: '9777777777', role: 'owner', societyId: s.id });
    const tenant = await User.create({ name: 'Tenant Test', phone: '9666666666', role: 'tenant', societyId: s.id });
    console.log('Created owner id=', owner.id, 'tenant id=', tenant.id);
    const token = jwt.sign({ id: owner.id, role: owner.role }, process.env.JWT_SECRET || 'dev', { expiresIn: '7d' });
    console.log('Token created');

    // call status endpoint to set inactive
    let res = await request(app).post(`/api/owner/tenants/${tenant.id}/status`).set('Authorization', 'Bearer ' + token).send({ status: 'inactive' });
    console.log('/status response', res.status, res.body);

    // fetch tenant from DB
    const tdb = await User.findByPk(tenant.id);
    console.log('Tenant in DB status =', tdb.status);
    process.exit(0);
  }catch(e){
    console.error('ERR', e && (e.stack || e));
    process.exit(1);
  }
}

run();

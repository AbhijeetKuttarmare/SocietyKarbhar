const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/models');

async function run(){
  try{
    // ensure DB is synced (use existing seed or create minimal data)
    await sequelize.sync({ force: true });
    console.log('DB synced');
    // create minimal data: create society and owner user
    const { User, Society } = require('../src/models');
    const s = await Society.create({ name: 'Test Society' });
    const owner = await User.create({ name: 'Test Owner', phone: '9777777777', role: 'owner', societyId: s.id });

    // request OTP for owner
    let res = await request(app).post('/api/auth/otp/request').send({ phone: '9777777777' });
    console.log('/otp/request', res.status, res.body);
    const code = res.body.code;
    if(!code){ console.error('no code returned'); return; }
    // verify OTP
    res = await request(app).post('/api/auth/otp/verify').send({ phone: '9777777777', code });
    console.log('/otp/verify', res.status, res.body);
    const token = res.body.token;
    if(!token) { console.error('no token'); return; }

    // use token to call owner endpoints
    res = await request(app).get('/api/owner/tenants').set('Authorization', `Bearer ${token}`);
    console.log('/owner/tenants', res.status, res.body);

    res = await request(app).post('/api/owner/tenants').set('Authorization', `Bearer ${token}`).send({ name: 'New Tenant', phone: '9666666666' });
    console.log('/owner/tenants POST', res.status, res.body);

    res = await request(app).post('/api/owner/maintenance').set('Authorization', `Bearer ${token}`).send({ title: 'Leaky pipe', description: 'Pipe in kitchen', cost: 500 });
    console.log('/owner/maintenance POST', res.status, res.body);

    res = await request(app).get('/api/owner/maintenance').set('Authorization', `Bearer ${token}`);
    console.log('/owner/maintenance GET', res.status, res.body);

    // upload flow: send dataUrl minimal
    res = await request(app).post('/api/owner/upload').set('Authorization', `Bearer ${token}`).send({ dataUrl: 'data:text/plain;base64,SGVsbG8=' });
    console.log('/owner/upload', res.status, res.body);

    // create a doc record (use returned url)
    const url = res.body.url;
    res = await request(app).post('/api/owner/documents').set('Authorization', `Bearer ${token}`).send({ title: 'Test Doc', file_url: url, file_type: 'text/plain' });
    console.log('/owner/documents POST', res.status, res.body);

    res = await request(app).get('/api/owner/documents').set('Authorization', `Bearer ${token}`);
    console.log('/owner/documents GET', res.status, res.body);

    process.exit(0);
  }catch(e){
    console.error(e && e.stack || e);
    process.exit(1);
  }
}

run();
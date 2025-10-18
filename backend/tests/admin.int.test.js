const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { sequelize, User, Society } = require('../src/models');

let token;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  // create society and an admin user
  const society = await Society.create({ name: 'Test Society', country: 'IN', city: 'Test', area: 'A' });
  const admin = await User.create({ name: 'Admin', phone: '9888888888', role: 'admin', societyId: society.id });
  token = jwt.sign({ id: admin.id, role: admin.role }, process.env.JWT_SECRET || 'dev', { expiresIn: '7d' });
});

afterAll(async () => {
  await sequelize.close();
});

test('GET /api/admin/summary returns counts', async () => {
  const res = await request(app).get('/api/admin/summary').set('Authorization', 'Bearer ' + token);
  expect(res.statusCode).toBe(200);
  expect(res.body).toHaveProperty('totalOwners');
});

test('CRUD helpline', async () => {
  // create
  let res = await request(app).post('/api/admin/helplines').set('Authorization', 'Bearer ' + token).send({ type: 'ambulance', phone: '999' });
  expect(res.statusCode).toBe(200);
  const id = res.body.helpline.id;
  // list
  res = await request(app).get('/api/admin/helplines').set('Authorization', 'Bearer ' + token);
  expect(res.statusCode).toBe(200);
  expect(Array.isArray(res.body.helplines)).toBe(true);
  // update
  res = await request(app).put('/api/admin/helplines/'+id).set('Authorization', 'Bearer ' + token).send({ name: 'Ambulance X' });
  expect(res.statusCode).toBe(200);
  // delete
  res = await request(app).delete('/api/admin/helplines/'+id).set('Authorization', 'Bearer ' + token);
  expect(res.statusCode).toBe(200);
});

test('CRUD buildings', async () => {
  // create
  let res = await request(app).post('/api/admin/buildings').set('Authorization', 'Bearer ' + token).send({ name: 'Wing A' });
  expect(res.statusCode).toBe(200);
  const id = res.body.building.id;
  // list
  res = await request(app).get('/api/admin/buildings').set('Authorization', 'Bearer ' + token);
  expect(res.statusCode).toBe(200);
  expect(Array.isArray(res.body.buildings)).toBe(true);
  // update
  res = await request(app).put('/api/admin/buildings/'+id).set('Authorization', 'Bearer ' + token).send({ name: 'Wing A1' });
  expect(res.statusCode).toBe(200);
  // delete
  res = await request(app).delete('/api/admin/buildings/'+id).set('Authorization', 'Bearer ' + token);
  expect(res.statusCode).toBe(200);
});

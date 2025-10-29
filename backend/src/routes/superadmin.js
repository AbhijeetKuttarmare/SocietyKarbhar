const express = require('express');
const router = express.Router();
const { Society, User, Building, SubscriptionPlan } = require('../models');
const bcrypt = require('bcrypt');
const { authenticate, authorize } = require('../middlewares/auth');

// Only superadmin can use these routes
router.use(authenticate, authorize(['superadmin']));

router.post('/societies', async (req, res) => {
  // accept either `mobile_number` or `mobile` from different frontends
  const { name, country, city, area } = req.body;
  const mobile_number = req.body.mobile_number || req.body.mobile;
  if (!name) return res.status(400).json({ error: 'name required' });
  // persist mobile_number as well so edit UI can read it back
  const society = await Society.create({
    name,
    country,
    city,
    area,
    mobile_number,
    created_by: req.user.id,
  });
  res.json({ society });
});

router.put('/societies/:id', async (req, res) => {
  const { id } = req.params;
  const { name, country, city, area, status, subscription_start_date, subscription_end_date } =
    req.body;
  // accept either `mobile_number` or `mobile` when updating
  const mobile_number = req.body.mobile_number || req.body.mobile;
  const soc = await Society.findByPk(id);
  if (!soc) return res.status(404).json({ error: 'not found' });
  await soc.update({
    name,
    country,
    city,
    area,
    mobile_number,
    status,
    subscription_start_date,
    subscription_end_date,
  });
  res.json({ society: soc });
});

router.delete('/societies/:id', async (req, res) => {
  const { id } = req.params;
  const soc = await Society.findByPk(id);
  if (!soc) return res.status(404).json({ error: 'not found' });
  await soc.destroy();
  res.json({ success: true });
});

router.post('/admins', async (req, res) => {
  const { name, phone, password, societyId } = req.body;
  if (!phone || !password || !societyId)
    return res.status(400).json({ error: 'phone,password,societyId required' });
  const password_hash = await bcrypt.hash(password, 10);
  const admin = await User.create({ name, phone, password_hash, role: 'admin' });

  // support passing single id or array of ids
  const ids = Array.isArray(societyId) ? societyId : [societyId];
  for (const sid of ids) {
    // create join records; ignore failures for missing societies
    try {
      await require('../models').AdminSociety.create({ userId: admin.id, societyId: sid });
    } catch (e) {}
  }

  // Return the created admin along with associated societies so UI can show names
  const models = require('../models');
  const created = await User.findByPk(admin.id, {
    include: [{ model: models.Society, as: 'adminSocieties', through: { attributes: [] } }],
  });

  res.json({ admin: created });
});

// List admins
router.get('/admins', async (req, res) => {
  const models = require('../models');
  // include the societies joined to each admin so frontend can display society names
  const admins = await User.findAll({
    where: { role: 'admin' },
    include: [{ model: models.Society, as: 'adminSocieties', through: { attributes: [] } }],
  });
  res.json({ admins });
});

// Update admin and assigned societies
router.put('/admins/:id', async (req, res) => {
  const { id } = req.params;
  const { name, phone, password, societyId } = req.body;
  const user = await User.findByPk(id);
  if (!user) return res.status(404).json({ error: 'not found' });
  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (password) user.password_hash = await bcrypt.hash(password, 10);
  await user.save();

  if (typeof societyId !== 'undefined') {
    const models = require('../models');
    // remove existing links
    await models.AdminSociety.destroy({ where: { userId: id } }).catch(() => {});
    const ids = Array.isArray(societyId) ? societyId : [societyId];
    for (const sid of ids) {
      try {
        await models.AdminSociety.create({ userId: id, societyId: sid });
      } catch (e) {}
    }
  }

  res.json({ admin: user });
});

// Buildings CRUD
router.get('/buildings', async (req, res) => {
  const buildings = await Building.findAll();
  res.json({ buildings });
});

router.post('/buildings', async (req, res) => {
  const { name, societyId, address } = req.body;
  if (!name || !societyId) return res.status(400).json({ error: 'name,societyId required' });
  const b = await Building.create({ name, societyId, address });
  res.json({ building: b });
});

router.put('/buildings/:id', async (req, res) => {
  const { id } = req.params;
  const b = await Building.findByPk(id);
  if (!b) return res.status(404).json({ error: 'not found' });
  await b.update(req.body);
  res.json({ building: b });
});

router.delete('/buildings/:id', async (req, res) => {
  const { id } = req.params;
  const b = await Building.findByPk(id);
  if (!b) return res.status(404).json({ error: 'not found' });
  await b.destroy();
  res.json({ success: true });
});

// Subscription plans
router.get('/plans', async (req, res) => {
  const plans = await SubscriptionPlan.findAll();
  res.json({ plans });
});

router.post('/plans', async (req, res) => {
  const { name, price, duration_months } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'name,price required' });
  const p = await SubscriptionPlan.create({ name, price, duration_months });
  res.json({ plan: p });
});

router.put('/plans/:id', async (req, res) => {
  const { id } = req.params;
  const p = await SubscriptionPlan.findByPk(id);
  if (!p) return res.status(404).json({ error: 'not found' });
  await p.update(req.body);
  res.json({ plan: p });
});

router.delete('/plans/:id', async (req, res) => {
  const { id } = req.params;
  const p = await SubscriptionPlan.findByPk(id);
  if (!p) return res.status(404).json({ error: 'not found' });
  await p.destroy();
  res.json({ success: true });
});

router.get('/societies', async (req, res) => {
  const models = require('../models');
  // Include admin(s) linked via the AdminSociety join so frontend can show admin names
  const societies = await Society.findAll({
    include: [{ model: models.User, as: 'admins', through: { attributes: [] } }],
  });
  res.json({ societies });
});

// Get single society by id (include full fields) - used by edit UI
router.get('/societies/:id', async (req, res) => {
  const { id } = req.params;
  const models = require('../models');
  const soc = await Society.findByPk(id, {
    include: [{ model: models.User, as: 'admins', through: { attributes: [] } }],
  });
  if (!soc) return res.status(404).json({ error: 'not found' });
  res.json({ society: soc });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { User, Flat } = require('../models');
const { Building, Helpline, Document, Agreement, SuperadminLog, Society } = require('../models');
const bcrypt = require('bcrypt');
const { authenticate, authorize } = require('../middlewares/auth');
const cloudinary = require('cloudinary').v2;

// configure cloudinary if env present
if(process.env.CLOUDINARY_URL){
  try{ cloudinary.config({ secure: true }); }catch(e){ console.warn('cloudinary config failed', e.message); }
}

router.use(authenticate, authorize(['admin']));

// Admin creates owner or tenant (by mobile number)
router.post('/users', async (req, res) => {
  const { name, phone, role, flat_no } = req.body;
  if(!phone || !role) return res.status(400).json({ error: 'phone and role required' });
  if(!['owner','tenant','security_guard'].includes(role)) return res.status(400).json({ error: 'invalid role' });
  try{
    const existing = await User.findOne({ where: { phone } });
    if(existing) return res.status(400).json({ error: 'user exists' });

    // determine societyId: prefer req.user.societyId, otherwise fallback to linked adminSocieties
    let societyId = req.user && req.user.societyId;
    if(!societyId && req.user && req.user.adminSocieties && req.user.adminSocieties.length){
      const first = req.user.adminSocieties[0];
      societyId = first && (first.id || first.societyId || null);
    }
    if(!societyId) return res.status(403).json({ error: 'admin not assigned to a society' });

    const user = await User.create({ name: name||phone, phone, role, societyId });
  if(role === 'owner' && flat_no){
      await Flat.create({ societyId, flat_no, ownerId: user.id });
  }
    res.json({ user });
  }catch(err){
    console.error('admin create user failed', err && err.stack || err);
    res.status(500).json({ error: 'failed to create user', detail: (err && err.message) || String(err) });
  }
});

// List societies assigned to this admin
router.get('/societies', async (req, res) => {
  const u = await User.findByPk(req.user.id, { include: [{ model: Society, as: 'adminSocieties' }] });
  const societies = (u && u.adminSocieties) || [];
  res.json({ societies });
});

// Get owners or tenants
router.get('/users', async (req, res) => {
  const { role } = req.query;
  const where = { societyId: req.user.societyId };
  if(role) where.role = role;
  const users = await User.findAll({ where });
  res.json({ users });
});

// Update user
router.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const user = await User.findByPk(id);
  if(!user || user.societyId !== req.user.societyId) return res.status(404).json({ error: 'not found' });
  await user.update(req.body);
  // log
  await SuperadminLog.create({ user_id: req.user.id, action_type: 'user_updated', details: { userId: user.id, changes: req.body } });
  res.json({ user });
});

// Wings/buildings (admin-scoped)
router.get('/buildings', async (req, res) => {
  const buildings = await Building.findAll({ where: { societyId: req.user.societyId } });
  res.json({ buildings });
});

router.post('/buildings', async (req, res) => {
  const { name, address, total_units } = req.body;
  if(!name) return res.status(400).json({ error: 'name required' });
  const b = await Building.create({ name, address, total_units: total_units || 0, societyId: req.user.societyId });
  await SuperadminLog.create({ user_id: req.user.id, action_type: 'building_created', details: { buildingId: b.id, name: b.name } });
  res.json({ building: b });
});

router.put('/buildings/:id', async (req, res) => {
  const { id } = req.params;
  const b = await Building.findByPk(id);
  if(!b || b.societyId !== req.user.societyId) return res.status(404).json({ error: 'not found' });
  await b.update(req.body);
  await SuperadminLog.create({ user_id: req.user.id, action_type: 'building_updated', details: { buildingId: b.id, changes: req.body } });
  res.json({ building: b });
});

router.delete('/buildings/:id', async (req, res) => {
  const { id } = req.params;
  const b = await Building.findByPk(id);
  if(!b || b.societyId !== req.user.societyId) return res.status(404).json({ error: 'not found' });
  await b.destroy();
  await SuperadminLog.create({ user_id: req.user.id, action_type: 'building_deleted', details: { buildingId: id } });
  res.json({ success: true });
});

// Helplines (services)
router.get('/helplines', async (req, res) => {
  const helplines = await Helpline.findAll({ where: { societyId: req.user.societyId } });
  res.json({ helplines });
});

router.post('/helplines', async (req, res) => {
  const { type, name, phone, notes } = req.body;
  if(!type || !phone) return res.status(400).json({ error: 'type and phone required' });
  const h = await Helpline.create({ type, name, phone, notes, societyId: req.user.societyId });
  await SuperadminLog.create({ user_id: req.user.id, action_type: 'helpline_created', details: { helplineId: h.id, type: h.type, phone: h.phone } });
  res.json({ helpline: h });
});

router.put('/helplines/:id', async (req, res) => {
  const { id } = req.params;
  const h = await Helpline.findByPk(id);
  if(!h || h.societyId !== req.user.societyId) return res.status(404).json({ error: 'not found' });
  await h.update(req.body);
  await SuperadminLog.create({ user_id: req.user.id, action_type: 'helpline_updated', details: { helplineId: h.id, changes: req.body } });
  res.json({ helpline: h });
});

router.delete('/helplines/:id', async (req, res) => {
  const { id } = req.params;
  const h = await Helpline.findByPk(id);
  if(!h || h.societyId !== req.user.societyId) return res.status(404).json({ error: 'not found' });
  await h.destroy();
  await SuperadminLog.create({ user_id: req.user.id, action_type: 'helpline_deleted', details: { helplineId: id } });
  res.json({ success: true });
});

// Dashboard summary
router.get('/summary', async (req, res) => {
  const totalOwners = await User.count({ where: { societyId: req.user.societyId, role: 'owner' } });
  const totalTenants = await User.count({ where: { societyId: req.user.societyId, role: 'tenant' } });
  const totalWings = await Building.count({ where: { societyId: req.user.societyId } });
  const totalHelplines = await Helpline.count({ where: { societyId: req.user.societyId } });
  res.json({ totalOwners, totalTenants, totalWings, totalHelplines });
});

// Upload file (accepts dataUrl or remote URL) -> returns { url }
router.post('/upload', async (req, res) => {
  const { dataUrl, filename } = req.body;
  if(!dataUrl) return res.status(400).json({ error: 'dataUrl required' });
  try{
    if(process.env.CLOUDINARY_URL){
      const opts = { folder: 'society_karbhar' };
      if(process.env.CLOUDINARY_UPLOAD_PRESET) opts.upload_preset = process.env.CLOUDINARY_UPLOAD_PRESET;
      if(filename) opts.public_id = filename.replace(/\.[^/.]+$/, '');
      const result = await cloudinary.uploader.upload(dataUrl, opts);
      return res.json({ url: result.secure_url });
    }
    // no cloudinary -> echo back the dataUrl (caller can store as-is)
    return res.json({ url: dataUrl });
  }catch(e){
    console.error('upload failed', e.message);
    return res.status(500).json({ error: 'upload failed', detail: e.message });
  }
});

// Logs - recent actions
router.get('/logs', async (req, res) => {
  const logs = await SuperadminLog.findAll({ order: [['createdAt','DESC']], limit: 200 });
  res.json({ logs });
});

// Documents for a user (owner or tenant)
router.get('/users/:id/documents', async (req, res) => {
  const { id } = req.params;
  const docs = await Document.findAll({ where: { uploaded_by: id, societyId: req.user.societyId } });
  res.json({ documents: docs });
});

// Upload/link document (we accept file_url in body; production should use Cloudinary upload)
router.post('/users/:id/documents', async (req, res) => {
  const { id } = req.params;
  const { title, file_url, file_type } = req.body;
  if(!file_url) return res.status(400).json({ error: 'file_url required' });
  const doc = await Document.create({ title, file_url, file_type, uploaded_by: id, societyId: req.user.societyId });
  await SuperadminLog.create({ user_id: req.user.id, action_type: 'document_uploaded', details: { userId: id, docId: doc.id } });
  res.json({ document: doc });
});

// Agreements (tenant-owner contracts)
router.post('/agreements', async (req, res) => {
  const { flatId, ownerId, tenantId, file_url, start_date, end_date } = req.body;
  if(!flatId || !ownerId || !tenantId || !file_url) return res.status(400).json({ error: 'flatId, ownerId, tenantId and file_url required' });
  const ag = await Agreement.create({ flatId, ownerId, tenantId, file_url, start_date, end_date });
  await SuperadminLog.create({ user_id: req.user.id, action_type: 'agreement_created', details: { agreementId: ag.id, flatId, ownerId, tenantId } });
  res.json({ agreement: ag });
});

router.get('/agreements', async (req, res) => {
  const ags = await Agreement.findAll({ where: { }, limit: 200 });
  res.json({ agreements: ags });
});

// User history: find actions via documents + agreements
router.get('/users/:id/history', async (req, res) => {
  const { id } = req.params;
  const docs = await Document.findAll({ where: { uploaded_by: id, societyId: req.user.societyId } });
  const agreements = await Agreement.findAll({ where: { [require('sequelize').Op.or]: [{ ownerId: id }, { tenantId: id }] } });
  res.json({ documents: docs, agreements });
});

// Search users by name/phone
router.get('/search/users', async (req, res) => {
  const q = req.query.q || '';
  const Op = require('sequelize').Op;
  const users = await User.findAll({ where: { societyId: req.user.societyId, [Op.or]: [{ name: { [Op.iLike]: `%${q}%` } }, { phone: { [Op.iLike]: `%${q}%` } }] }, limit: 100 });
  res.json({ users });
});

module.exports = router;

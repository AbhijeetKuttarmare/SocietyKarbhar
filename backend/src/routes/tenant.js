const express = require('express');
const router = express.Router();
const { Complaint } = require('../models');
const { authenticate } = require('../middlewares/auth');
const cloudinary = require('cloudinary').v2;

// cloudinary is configured centrally in app.js if env vars present
try{ if(process.env.CLOUDINARY_URL){ cloudinary.config({ secure: true }); } }catch(e){}

// Tenant routes: list/create maintenance & complaints under /api
router.use(authenticate);

// List maintenance requests raised by current user
router.get('/maintenance', async (req, res) => {
  try{
    const items = await Complaint.findAll({ where: { societyId: req.user.societyId, raised_by: req.user.id }, order: [['createdAt','DESC']] });
    res.json({ maintenance: items });
  }catch(e){ console.error('tenant maintenance list failed', e); res.status(500).json({ error: 'failed', detail: e && e.message }); }
});

// Create a maintenance request (tenant)
router.post('/maintenance', async (req, res) => {
  try{
    const { title, description, cost } = req.body;
    if(!title) return res.status(400).json({ error: 'title required' });
    const c = await Complaint.create({ title, description, status: 'open', cost: cost || 0, societyId: req.user.societyId, raised_by: req.user.id });
    res.json({ maintenance: c });
  }catch(e){ console.error('tenant create maintenance failed', e); res.status(500).json({ error: 'failed', detail: e && e.message }); }
});

// List complaints raised by current user
router.get('/complaints', async (req, res) => {
  try{
    const items = await Complaint.findAll({ where: { societyId: req.user.societyId, raised_by: req.user.id }, order: [['createdAt','DESC']] });
    res.json({ complaints: items });
  }catch(e){ console.error('tenant complaints list failed', e); res.status(500).json({ error: 'failed', detail: e && e.message }); }
});

// Create a complaint (tenant)
router.post('/complaints', async (req, res) => {
  try{
    const { title, description, cost } = req.body;
    if(!title) return res.status(400).json({ error: 'title required' });
    const c = await Complaint.create({ title, description, status: 'open', cost: cost || 0, societyId: req.user.societyId, raised_by: req.user.id });
    res.json({ complaint: c });
  }catch(e){ console.error('tenant create complaint failed', e); res.status(500).json({ error: 'failed', detail: e && e.message }); }
});

// Support messages (tenant -> owner). Frontend posts { message }
router.post('/support', async (req, res) => {
  try{
    const { message } = req.body;
    if(!message) return res.status(400).json({ error: 'message required' });
    // Store as a Complaint record for now so owners can track support requests
    const c = await Complaint.create({ title: 'Support request', description: message, status: 'open', societyId: req.user.societyId, raised_by: req.user.id });
    res.json({ support: c });
  }catch(e){ console.error('tenant support post failed', e); res.status(500).json({ error: 'failed', detail: e && e.message }); }
});

// Upload endpoint for authenticated users (accepts dataUrl) -> { url }
router.post('/upload', async (req, res) => {
  const { dataUrl, filename } = req.body;
  if(!dataUrl) return res.status(400).json({ error: 'dataUrl required' });
  try{
    if(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET){
      const opts = { folder: 'society_karbhar' };
      if(process.env.CLOUDINARY_UPLOAD_PRESET) opts.upload_preset = process.env.CLOUDINARY_UPLOAD_PRESET;
      if(filename) opts.public_id = filename.replace(/\.[^/.]+$/, '');
      const result = await cloudinary.uploader.upload(dataUrl, opts);
      return res.json({ url: result.secure_url });
    }
    return res.json({ url: dataUrl });
  }catch(e){ console.error('tenant upload failed', e && e.message); return res.status(500).json({ error: 'upload failed', detail: e && e.message }); }
});

// Current authenticated user: get and update profile
router.get('/user', async (req, res) => {
  try{
    const models = require('../models');
    const u = await models.User.findByPk(req.user.id);
    res.json({ user: u });
  }catch(e){ console.error('get user failed', e); res.status(500).json({ error: 'failed' }); }
});

router.put('/user', async (req, res) => {
  try{
    const models = require('../models');
    const u = await models.User.findByPk(req.user.id);
    if(!u) return res.status(404).json({ error: 'not found' });
    // allow list of safe fields only
    const allowed = ['name','phone','email','address','avatar','mobile_number'];
    const updates = {};
    for(const k of allowed) if(req.body[k] !== undefined) updates[k] = req.body[k];
    await u.update(updates);
    res.json({ user: u });
  }catch(e){ console.error('update user failed', e); res.status(500).json({ error: 'failed', detail: e && e.message }); }
});

module.exports = router;

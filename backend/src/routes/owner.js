const express = require('express');
const router = express.Router();
const { User, Flat, Complaint, Document, Agreement } = require('../models');
const { Op } = require('sequelize');
const { authenticate, authorize } = require('../middlewares/auth');
const cloudinary = require('cloudinary').v2;

// configure cloudinary if env present
if (process.env.CLOUDINARY_URL) {
  try {
    cloudinary.config({ secure: true });
  } catch (e) {
    console.warn('cloudinary config failed', e.message);
  }
}

// Owners (and admins) may access these routes
router.use(authenticate, authorize(['owner', 'admin']));

// List tenants in the owner's society
router.get('/tenants', async (req, res) => {
  try {
    const users = await User.findAll({ where: { societyId: req.user.societyId, role: 'tenant' } });
    // attach current agreement/flat information for each tenant when available
    const tenantIds = users.map((u) => u.id);
    const agreements = tenantIds.length
      ? await Agreement.findAll({ where: { tenantId: tenantIds } })
      : [];
    const flatIds = agreements.map((a) => a.flatId).filter(Boolean);
    const flats = flatIds.length ? await Flat.findAll({ where: { id: flatIds } }) : [];
    const agByTenant = {};
    agreements.forEach((a) => {
      agByTenant[a.tenantId] = a;
    });
    const flatsById = {};
    flats.forEach((f) => {
      flatsById[f.id] = f;
    });

    const usersPlain = users.map((u) => {
      const p = u.get ? u.get({ plain: true }) : u;
      const ag = agByTenant[p.id];
      if (ag && flatsById[ag.flatId]) {
        p.flat = { id: flatsById[ag.flatId].id, flat_no: flatsById[ag.flatId].flat_no };
      }
      return p;
    });
    res.json({ users: usersPlain });
  } catch (e) {
    console.error('owner list tenants failed', e);
    res.status(500).json({ error: 'failed' });
  }
});

// Create a tenant (owner can create tenants for their society)
router.post('/tenants', async (req, res) => {
  try {
    const {
      name,
      phone: rawPhone,
      address,
      rent,
      deposit,
      gender,
      move_in,
      move_out,
      flatId,
    } = req.body;
    const phone = String(rawPhone || '').replace(/\D/g, '');
    if (!phone) return res.status(400).json({ error: 'phone required' });
    const existing = await User.findOne({ where: { phone } });
    if (existing) return res.status(400).json({ error: 'user exists' });
    const user = await User.create({
      name: name || phone,
      phone,
      role: 'tenant',
      societyId: req.user.societyId,
      address,
      rent: rent || null,
      deposit: deposit || null,
      gender: gender || null,
      move_in: move_in || null,
      move_out: move_out || null,
    });

    // If flatId provided, create an Agreement linking tenant to flat (owner is current user)
    if (flatId) {
      try {
        await Agreement.create({ flatId, ownerId: req.user.id, tenantId: user.id });
      } catch (err) {
        console.warn('[owner/create] failed to create agreement', err && err.message);
      }
    }

    res.json({ user });
  } catch (e) {
    console.error('owner create tenant failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Update tenant profile
router.put('/tenants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = await User.findByPk(id);
    if (!tenant || tenant.societyId !== req.user.societyId)
      return res.status(404).json({ error: 'not found' });
    const allowed = [
      'name',
      'address',
      'gender',
      'move_in',
      'move_out',
      'rent',
      'deposit',
      'phone',
      'status',
    ];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    await tenant.update(updates);

    // If a flatId is provided in the update body, create an Agreement linking this tenant to that flat
    const { flatId } = req.body;
    if (flatId) {
      try {
        await Agreement.create({ flatId, ownerId: req.user.id, tenantId: tenant.id });
      } catch (err) {
        console.warn('[owner/update] failed to create agreement', err && err.message);
      }
    }

    res.json({ user: tenant });
  } catch (e) {
    console.error('owner update tenant failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Toggle tenant status (activate/deactivate)
router.post('/tenants/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'active' or 'inactive'
    if (!['active', 'inactive'].includes(status))
      return res.status(400).json({ error: 'invalid status' });
    const tenant = await User.findByPk(id);
    // debug logs to help trace why toggle might fail
    try {
      console.log(
        '[owner/status] req.user.id=',
        req.user && req.user.id,
        'req.user.societyId=',
        req.user && req.user.societyId,
        'targetTenantId=',
        id
      );
    } catch (e) {}
    try {
      console.log(
        '[owner/status] tenant found=',
        !!tenant,
        'tenant.societyId=',
        tenant && tenant.societyId
      );
    } catch (e) {}
    if (!tenant) return res.status(404).json({ error: 'not found' });

    // If tenant record exists but has no societyId (legacy/missing data),
    // assign it to the requesting owner's society so the owner can manage the tenant.
    // If tenant already has a societyId and it doesn't match the owner's, reject.
    if (!tenant.societyId) {
      try {
        await tenant.update({ societyId: req.user.societyId });
        console.log(
          '[owner/status] assigned missing societyId to tenant',
          tenant.id,
          '->',
          req.user.societyId
        );
      } catch (e) {
        console.warn(
          '[owner/status] failed to assign societyId to tenant',
          tenant.id,
          e && e.message
        );
      }
    } else if (tenant.societyId !== req.user.societyId) {
      return res.status(404).json({ error: 'not found' });
    }

    // Prevent re-activation: once a tenant is set to 'inactive' it cannot be moved back to 'active'
    if (tenant.status === 'inactive' && status === 'active') {
      console.log('[owner/status] reactivation attempt blocked for tenant', tenant.id);
      return res.status(403).json({ error: 'reactivation not allowed' });
    }

    // Proceed to update status (deactivation allowed, activation only if not previously inactive)
    await tenant.update({ status });
    res.json({ user: tenant });
  } catch (e) {
    console.error('owner tenant status failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Tenant history for owner: agreements + documents (owner-scoped)
router.get('/tenants/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = await User.findByPk(id);
    if (!tenant || tenant.societyId !== req.user.societyId)
      return res.status(404).json({ error: 'not found' });

    const agreements = await Agreement.findAll({ where: { tenantId: id } });
    const documents = await Document.findAll({
      where: { uploaded_by: id, societyId: req.user.societyId },
    });

    res.json({ agreements, documents });
  } catch (e) {
    console.error('owner tenant history failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Maintenance (use Complaint model)
router.get('/maintenance', async (req, res) => {
  try {
    const where = { societyId: req.user.societyId };
    // Owners see maintenance raised by them or assigned to them
    const complaints = await Complaint.findAll({
      where: { societyId: req.user.societyId, raised_by: req.user.id },
    });
    res.json({ maintenance: complaints });
  } catch (e) {
    console.error('owner maintenance list failed', e);
    res.status(500).json({ error: 'failed' });
  }
});

router.post('/maintenance', async (req, res) => {
  try {
    const { title, description, cost } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const c = await Complaint.create({
      title,
      description,
      status: 'open',
      cost: cost || 0,
      societyId: req.user.societyId,
      raised_by: req.user.id,
    });
    res.json({ maintenance: c });
  } catch (e) {
    console.error('owner create maintenance failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Upload file (owner fallback) -> returns { url }
router.post('/upload', async (req, res) => {
  const { dataUrl, filename } = req.body;
  if (!dataUrl) return res.status(400).json({ error: 'dataUrl required' });
  try {
    if (
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    ) {
      const opts = { folder: 'society_karbhar' };
      if (process.env.CLOUDINARY_UPLOAD_PRESET)
        opts.upload_preset = process.env.CLOUDINARY_UPLOAD_PRESET;
      if (filename) opts.public_id = filename.replace(/\.[^/.]+$/, '');
      const result = await cloudinary.uploader.upload(dataUrl, opts);
      return res.json({ url: result.secure_url });
    }
    return res.json({ url: dataUrl });
  } catch (e) {
    console.error('owner upload failed', e);
    return res.status(500).json({ error: 'upload failed', detail: e && e.message });
  }
});

// Documents uploaded by this owner
router.get('/documents', async (req, res) => {
  try {
    const docs = await Document.findAll({
      where: { societyId: req.user.societyId, uploaded_by: req.user.id },
    });
    res.json({ documents: docs });
  } catch (e) {
    console.error('owner docs list failed', e);
    res.status(500).json({ error: 'failed' });
  }
});

// Helplines (owners should see admin/global helplines + society-specific ones)
router.get('/helplines', async (req, res) => {
  try {
    // Helpline model may be registered on sequelize models
    const { Helpline } = require('../models');
    if (!Helpline) return res.json({ helplines: [] });

    // Return helplines that are global (societyId IS NULL) OR belong to this society
    const helplines = await Helpline.findAll({
      where: {
        [Op.or]: [{ societyId: req.user.societyId }, { societyId: null }],
      },
      order: [['name', 'ASC']],
    });

    res.json({ helplines });
  } catch (e) {
    console.error('owner helplines failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Create a helpline (owner can add helpline numbers for their society)
router.post('/helplines', async (req, res) => {
  try {
    const { name, phone, type, notes } = req.body;
    const phoneClean = phone ? String(phone).trim() : '';
    if (!phoneClean) return res.status(400).json({ error: 'phone required' });
    const { Helpline } = require('../models');
    if (!Helpline) return res.status(500).json({ error: 'helpline model not available' });

    const created = await Helpline.create({
      societyId: req.user.societyId,
      type: type || 'general',
      name: name || null,
      phone: phoneClean,
      notes: notes || null,
    });

    res.json({ helpline: created });
  } catch (e) {
    console.error('owner create helpline failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

router.post('/documents', async (req, res) => {
  try {
    const { title, file_url, file_type } = req.body;
    if (!file_url) return res.status(400).json({ error: 'file_url required' });
    const doc = await Document.create({
      title,
      file_url,
      file_type,
      uploaded_by: req.user.id,
      societyId: req.user.societyId,
    });
    res.json({ document: doc });
  } catch (e) {
    console.error('owner create doc failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

module.exports = router;

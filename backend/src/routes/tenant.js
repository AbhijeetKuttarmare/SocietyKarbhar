const express = require('express');
const router = express.Router();
const { Complaint } = require('../models');
const { Op } = require('sequelize');
const { authenticate } = require('../middlewares/auth');
const cloudinary = require('cloudinary').v2;

// cloudinary is configured centrally in app.js if env vars present
try {
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({ secure: true });
  }
} catch (e) {}

// Tenant routes: list/create maintenance & complaints under /api
router.use(authenticate);

// List maintenance requests raised by current user
router.get('/maintenance', async (req, res) => {
  try {
    const items = await Complaint.findAll({
      where: { societyId: req.user.societyId, raised_by: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    res.json({ maintenance: items });
  } catch (e) {
    console.error('tenant maintenance list failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Create a maintenance request (tenant)
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
    console.error('tenant create maintenance failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// List complaints raised by current user
router.get('/complaints', async (req, res) => {
  try {
    const items = await Complaint.findAll({
      where: { societyId: req.user.societyId, raised_by: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    res.json({ complaints: items });
  } catch (e) {
    console.error('tenant complaints list failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Create a complaint (tenant)
router.post('/complaints', async (req, res) => {
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
    res.json({ complaint: c });
  } catch (e) {
    console.error('tenant create complaint failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Support messages (tenant -> owner). Frontend posts { message }
router.post('/support', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });
    // Store as a Complaint record for now so owners can track support requests
    const c = await Complaint.create({
      title: 'Support request',
      description: message,
      status: 'open',
      societyId: req.user.societyId,
      raised_by: req.user.id,
    });
    res.json({ support: c });
  } catch (e) {
    console.error('tenant support post failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Upload endpoint for authenticated users (accepts dataUrl) -> { url }
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
    console.error('tenant upload failed', e && e.message);
    return res.status(500).json({ error: 'upload failed', detail: e && e.message });
  }
});

// Current authenticated user: get and update profile
router.get('/user', async (req, res) => {
  try {
    const models = require('../models');
    const u = await models.User.findByPk(req.user.id);
    res.json({ user: u });
  } catch (e) {
    console.error('get user failed', e);
    res.status(500).json({ error: 'failed' });
  }
});

router.put('/user', async (req, res) => {
  try {
    const models = require('../models');
    const u = await models.User.findByPk(req.user.id);
    if (!u) return res.status(404).json({ error: 'not found' });
    // allow list of safe fields only
    const allowed = ['name', 'phone', 'email', 'address', 'avatar', 'mobile_number'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    await u.update(updates);
    res.json({ user: u });
  } catch (e) {
    console.error('update user failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Return the owner profile for the current tenant (owner who added the tenant / owner of the flat)
// Expose tenant-scoped owner lookup at /api/tenant/owner to avoid colliding with /api/owner
router.get('/tenant/owner', async (req, res) => {
  try {
    console.log('[tenant/owner] lookup for user:', req.user && req.user.id);
    const models = require('../models');
    const { Agreement, User, Flat } = models;

    // Find latest agreement for this tenant
    const ag = await Agreement.findOne({
      where: { tenantId: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    console.log('[tenant/owner] agreement lookup result:', !!ag);
    if (ag && ag.ownerId) {
      console.log('[tenant/owner] agreement has ownerId:', ag.ownerId);
      const owner = await User.findByPk(ag.ownerId);
      console.log('[tenant/owner] owner found via agreement:', !!owner);
      if (owner) {
        // include tenant profile so client can show both names reliably
        const tenantProfile = await User.findByPk(req.user.id);
        return res.json({ owner, tenant: tenantProfile });
      }
    }

    // Additional fallback: some flows may have stored owner info on the tenant record itself
    // (older versions or alternate flows). Check tenant record for ownerId/flatId fields
    try {
      const tenantRecord = await User.findByPk(req.user.id);
      if (tenantRecord) {
        // if tenant record has an ownerId field
        if (tenantRecord.ownerId) {
          const owner = await User.findByPk(tenantRecord.ownerId);
          if (owner) {
            console.log('[tenant/owner] owner found via tenant.ownerId:', tenantRecord.ownerId);
            const tenantProfile = await User.findByPk(req.user.id);
            return res.json({ owner, tenant: tenantProfile });
          }
        }
        // if tenant record has flatId, try to resolve owner from flat
        if (tenantRecord.flatId) {
          const flatFromTenant = await Flat.findByPk(tenantRecord.flatId);
          if (flatFromTenant && flatFromTenant.ownerId) {
            const owner = await User.findByPk(flatFromTenant.ownerId);
            if (owner) {
              console.log(
                '[tenant/owner] owner found via tenant.flatId -> flat.ownerId:',
                flatFromTenant.id
              );
              const tenantProfile = await User.findByPk(req.user.id);
              return res.json({ owner, tenant: tenantProfile });
            }
          }
        }
      }
    } catch (e) {
      console.warn('[tenant/owner] tenant-record based fallback failed', e && e.message);
    }

    // Fallback: try to find flat where this tenant is linked via agreements and then owner from flat
    if (ag && ag.flatId) {
      console.log('[tenant/owner] agreement has flatId, checking flat:', ag.flatId);
      const flat = await Flat.findByPk(ag.flatId);
      console.log('[tenant/owner] flat lookup result:', !!flat, flat && flat.ownerId);
      if (flat && flat.ownerId) {
        const owner = await User.findByPk(flat.ownerId);
        console.log('[tenant/owner] owner found via flat.ownerId:', !!owner);
        if (owner) {
          const tenantProfile = await User.findByPk(req.user.id);
          return res.json({ owner, tenant: tenantProfile });
        }
      }
    }

    // No owner found
    console.log('[tenant/owner] no owner found for tenant:', req.user && req.user.id);

    // Fallback: if no agreement/flat-owner link exists, try to return any owner in the same society
    // This is a best-effort fallback to avoid showing a blank screen in the tenant app.
    try {
      const anyFlat = await Flat.findOne({
        where: { societyId: req.user.societyId, ownerId: { [Op.ne]: null } },
      });
      if (anyFlat && anyFlat.ownerId) {
        const owner = await User.findByPk(anyFlat.ownerId);
        if (owner) {
          console.log('[tenant/owner] returning fallback owner from flat:', anyFlat.id);
          return res.json({ owner, fallback: true });
        }
      }
    } catch (e2) {
      console.warn('[tenant/owner] fallback lookup failed', e2 && e2.message);
    }

    // return tenant profile as well so UI can display tenant name even when owner is missing
    const tenantProfile = await User.findByPk(req.user.id);
    res.json({ owner: null, tenant: tenantProfile || null });
  } catch (e) {
    console.error('tenant owner lookup failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Debug endpoint: list agreements for current tenant with linked flat and owner data
router.get('/tenant/agreements', async (req, res) => {
  try {
    const models = require('../models');
    const { Agreement, Flat, User } = models;
    const ags = await Agreement.findAll({
      where: { tenantId: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    const detailed = [];
    // include tenant profile once so client can display tenant name
    const tenantProfile = await User.findByPk(req.user.id);
    for (const a of ags) {
      const flat = a.flatId ? await Flat.findByPk(a.flatId) : null;
      let owner = null;
      if (a.ownerId) owner = await User.findByPk(a.ownerId);
      else if (flat && flat.ownerId) owner = await User.findByPk(flat.ownerId);
      detailed.push({
        agreement: a,
        flat: flat || null,
        owner: owner || null,
        tenant: tenantProfile || null,
      });
    }
    res.json({ agreements: detailed });
  } catch (e) {
    console.error('tenant agreements debug failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Tenant: list helplines (global + society-specific)
router.get('/tenant/helplines', async (req, res) => {
  try {
    const models = require('../models');
    const { Helpline } = models;
    if (!Helpline) return res.json({ helplines: [] });
    const helplines = await Helpline.findAll({
      where: {
        [Op.or]: [{ societyId: req.user.societyId }, { societyId: null }],
      },
      order: [['name', 'ASC']],
    });
    res.json({ helplines });
  } catch (e) {
    console.error('tenant helplines failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Tenant: add helpline for their society
router.post('/tenant/helplines', async (req, res) => {
  try {
    const { name, phone, type, notes } = req.body;
    const phoneClean = phone ? String(phone).trim() : '';
    if (!phoneClean) return res.status(400).json({ error: 'phone required' });
    const models = require('../models');
    const { Helpline } = models;
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
    console.error('tenant create helpline failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Keep legacy /owner route (may be shadowed by owner router mounting) but leave for compatibility.
router.get('/owner', async (req, res) => {
  try {
    const models = require('../models');
    const { Agreement, User, Flat } = models;

    const ag = await Agreement.findOne({
      where: { tenantId: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    if (ag && ag.ownerId) {
      const owner = await User.findByPk(ag.ownerId);
      if (owner) return res.json({ owner });
    }

    if (ag && ag.flatId) {
      const flat = await Flat.findByPk(ag.flatId);
      if (flat && flat.ownerId) {
        const owner = await User.findByPk(flat.ownerId);
        if (owner) return res.json({ owner });
      }
    }

    res.json({ owner: null });
  } catch (e) {
    console.error('tenant owner lookup failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

module.exports = router;

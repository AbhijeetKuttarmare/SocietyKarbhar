const express = require('express');
const router = express.Router();
const { User, Flat, Complaint, Document, Agreement, Bill } = require('../models');
const { Op } = require('sequelize');
const { authenticate, authorize } = require('../middlewares/auth');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

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

// Flats accessible to this owner
router.get('/flats', async (req, res) => {
  try {
    const { Flat } = require('../models');
    // return flats in this society that belong to this owner
    const flats = await Flat.findAll({
      where: { societyId: req.user.societyId, ownerId: req.user.id },
    });
    res.json({ flats });
  } catch (e) {
    console.error('owner get flats failed', e && e.message);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

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

    // If owner provided identity URLs (aadhaar/pan) include them as documents
    try {
      const aadhaar = req.body.aadhaar_url || req.body.aadhaar || null;
      const pan = req.body.pan_url || req.body.pan || null;
      const docsToCreate = [];
      if (aadhaar)
        docsToCreate.push({
          title: 'Aadhaar',
          file_url: aadhaar,
          file_type: 'application/octet-stream',
        });
      if (pan)
        docsToCreate.push({ title: 'PAN', file_url: pan, file_type: 'application/octet-stream' });

      for (const d of docsToCreate) {
        try {
          // avoid duplicate identical file_url entries for same tenant
          const existing = await Document.findOne({
            where: { uploaded_by: user.id, file_url: d.file_url },
          });
          if (!existing) {
            await Document.create({
              title: d.title,
              file_url: d.file_url,
              file_type: d.file_type,
              uploaded_by: user.id,
              societyId: req.user.societyId,
            });
          }
        } catch (e) {
          console.warn('[owner/create] failed to create identity document', e && e.message);
        }
      }
    } catch (e) {
      console.warn('[owner/create] identity docs processing failed', e && e.message);
    }

    // If flatId provided, validate the flat (must belong to this society) and
    // ensure agreement links tenant -> flat -> owner. Prefer the flat.ownerId if set,
    // otherwise assign the current owner (req.user.id) to the flat and use that.
    if (flatId) {
      try {
        const f = await Flat.findByPk(flatId);
        if (!f || f.societyId !== req.user.societyId) {
          console.warn('[owner/create] flat not found or not in owner society', flatId);
        } else {
          // ensure the flat has an ownerId; if missing, set to current owner
          let finalOwnerId = f.ownerId || req.user.id;
          if (!f.ownerId) {
            try {
              await f.update({ ownerId: req.user.id });
              finalOwnerId = req.user.id;
            } catch (e) {
              console.warn('[owner/create] failed to assign owner to flat', e && e.message);
            }
          }
          try {
            await Agreement.create({ flatId, ownerId: finalOwnerId, tenantId: user.id });
          } catch (err) {
            console.warn('[owner/create] failed to create agreement', err && err.message);
          }
        }
      } catch (err) {
        console.warn('[owner/create] validation for flat failed', err && err.message);
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
      // allow owner to set tenant Aadhaar/PAN URLs
      'aadhaar_url',
      'pan_url',
      'status',
    ];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    await tenant.update(updates);

    // If a flatId is provided in the update body, validate and create an Agreement linking this tenant to that flat
    const { flatId } = req.body;
    if (flatId) {
      try {
        const f = await Flat.findByPk(flatId);
        if (!f || f.societyId !== req.user.societyId) {
          console.warn('[owner/update] flat not found or not in owner society', flatId);
        } else {
          // ensure flat has an owner; prefer existing ownerId otherwise assign to current owner
          let finalOwnerId = f.ownerId || req.user.id;
          if (!f.ownerId) {
            try {
              await f.update({ ownerId: req.user.id });
              finalOwnerId = req.user.id;
            } catch (e) {
              console.warn('[owner/update] failed to assign owner to flat', e && e.message);
            }
          }
          try {
            await Agreement.create({ flatId, ownerId: finalOwnerId, tenantId: tenant.id });
          } catch (err) {
            console.warn('[owner/update] failed to create agreement', err && err.message);
          }
        }
      } catch (err) {
        console.warn('[owner/update] validation for flat failed', err && err.message);
      }
    }

    // If the owner supplied aadhaar_url / pan_url in update body, persist them as Documents
    try {
      const aadhaar = req.body.aadhaar_url || req.body.aadhaar || null;
      const pan = req.body.pan_url || req.body.pan || null;
      const docsToCreate = [];
      if (aadhaar) docsToCreate.push({ title: 'Aadhaar', file_url: aadhaar });
      if (pan) docsToCreate.push({ title: 'PAN', file_url: pan });
      for (const d of docsToCreate) {
        try {
          const existing = await Document.findOne({
            where: { uploaded_by: tenant.id, file_url: d.file_url },
          });
          if (!existing) {
            await Document.create({
              title: d.title,
              file_url: d.file_url,
              file_type: d.file_type || 'application/octet-stream',
              uploaded_by: tenant.id,
              societyId: req.user.societyId,
            });
          }
        } catch (e) {
          console.warn('[owner/update] failed to create identity document', e && e.message);
        }
      }
    } catch (e) {
      console.warn('[owner/update] identity docs processing failed', e && e.message);
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

// Bills (owner-created bills) - saved in `bills` table
router.get('/bills', async (req, res) => {
  try {
    // Owners see bills they raised in their society
    const bills = await Bill.findAll({
      where: { societyId: req.user.societyId, raised_by: req.user.id },
    });
    res.json({ bills });
  } catch (e) {
    console.error('owner bills list failed', e && e.message);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Bills assigned to this owner (e.g., maintenance generated by admin)
router.get('/bills/assigned', async (req, res) => {
  try {
    const bills = await Bill.findAll({
      where: { societyId: req.user.societyId, assigned_to: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    res.json({ bills });
  } catch (e) {
    console.error('owner assigned bills list failed', e && e.message);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

router.post('/bills', async (req, res) => {
  try {
    const { title, description, cost, tenantId, type } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    // validate type
    const allowedTypes = ['rent', 'electricity', 'other'];
    if (type && !allowedTypes.includes(String(type).toLowerCase()))
      return res.status(400).json({ error: 'invalid type' });
    const b = await Bill.create({
      title,
      description,
      type: type ? String(type).toLowerCase() : 'other',
      status: 'open',
      cost: cost || 0,
      societyId: req.user.societyId,
      raised_by: req.user.id,
      assigned_to: tenantId || null,
    });
    res.json({ bill: b });
  } catch (e) {
    console.error('owner create bill failed', e && e.message);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Owner: verify a bill payment (approve/reject)
router.post('/bills/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'approve' | 'reject'
    if (!['approve', 'reject'].includes(action))
      return res.status(400).json({ error: 'invalid action' });
    const bill = await Bill.findByPk(id);
    if (!bill || bill.societyId !== req.user.societyId)
      return res.status(404).json({ error: 'not found' });

    if (action === 'approve') {
      await bill.update({ status: 'closed' });
    } else {
      // reject: move back to open so tenant can retry/clarify
      await bill.update({ status: 'open' });
    }

    res.json({ bill });
  } catch (e) {
    console.error('owner verify bill failed', e && e.message);
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

// Upload file via multipart/form-data (file field `file`) -> returns { url }
router.post('/upload_form', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'file required' });
    try {
      console.log(
        '[owner/upload_form] received file:',
        file.originalname,
        file.mimetype,
        'size=',
        file.size || (file.buffer && file.buffer.length)
      );
    } catch (e) {}

    if (
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    ) {
      const opts = { folder: 'society_karbhar' };
      if (process.env.CLOUDINARY_UPLOAD_PRESET)
        opts.upload_preset = process.env.CLOUDINARY_UPLOAD_PRESET;
      const dataUrl = `data:${
        file.mimetype || 'application/octet-stream'
      };base64,${file.buffer.toString('base64')}`;
      const result = await cloudinary.uploader.upload(dataUrl, opts);
      console.log('[owner/upload_form] uploaded to cloudinary', result && result.secure_url);
      return res.json({ url: result.secure_url });
    }

    const base64 = file.buffer.toString('base64');
    const mime = file.mimetype || 'application/octet-stream';
    return res.json({ url: `data:${mime};base64,${base64}` });
  } catch (e) {
    console.error('owner upload_form failed', e && e.message, e && e.stack);
    return res.status(500).json({
      error: 'upload failed',
      detail: e && e.message,
      stack: process.env.NODE_ENV !== 'production' ? e && e.stack : undefined,
    });
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
    const { title, file_url, file_type, tenantId, userId } = req.body;
    if (!file_url) return res.status(400).json({ error: 'file_url required' });

    // If the owner provided a tenantId (or userId) it means this document is intended
    // for that tenant's history. In that case, set uploaded_by to the tenant's id so
    // it appears in tenant history endpoints which query by uploaded_by = tenantId.
    const targetUserId = tenantId || userId || null;
    const uploadedBy = targetUserId || req.user.id;

    const doc = await Document.create({
      title,
      file_url,
      file_type,
      uploaded_by: uploadedBy,
      societyId: req.user.societyId,
    });
    res.json({ document: doc });
  } catch (e) {
    console.error('owner create doc failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Delete a document (owner-scoped) - owners may delete documents belonging to their society
router.delete('/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Document.findByPk(id);
    if (!doc || doc.societyId !== req.user.societyId) {
      return res.status(404).json({ error: 'not found' });
    }

    await doc.destroy();
    res.json({ success: true });
  } catch (e) {
    console.error('owner delete doc failed', e && e.message);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

module.exports = router;

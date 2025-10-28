const express = require('express');
const router = express.Router();
const { User, Flat } = require('../models');
const {
  Building,
  Helpline,
  Document,
  Agreement,
  SuperadminLog,
  Society,
  Notice,
  NoticeRecipient,
  Complaint,
} = require('../models');
const bcrypt = require('bcrypt');
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

router.use(authenticate, authorize(['admin']));

// Admin creates owner or tenant (by mobile number)
router.post('/users', async (req, res) => {
  const { name, phone: rawPhone, role, flat_no } = req.body;
  const phone = String(rawPhone || '').replace(/\D/g, '');
  if (!phone || !role) return res.status(400).json({ error: 'phone and role required' });
  if (!['owner', 'tenant', 'security_guard'].includes(role))
    return res.status(400).json({ error: 'invalid role' });
  try {
    const existing = await User.findOne({ where: { phone } });
    if (existing) return res.status(400).json({ error: 'user exists' });

    // determine societyId: prefer req.user.societyId, otherwise fallback to linked adminSocieties
    let societyId = req.user && req.user.societyId;
    if (!societyId && req.user && req.user.adminSocieties && req.user.adminSocieties.length) {
      const first = req.user.adminSocieties[0];
      societyId = first && (first.id || first.societyId || null);
    }
    if (!societyId) return res.status(403).json({ error: 'admin not assigned to a society' });

    const user = await User.create({ name: name || phone, phone, role, societyId });
    if (role === 'owner' && flat_no) {
      await Flat.create({ societyId, flat_no, ownerId: user.id });
    }
    res.json({ user });
  } catch (err) {
    console.error('admin create user failed', (err && err.stack) || err);
    res
      .status(500)
      .json({ error: 'failed to create user', detail: (err && err.message) || String(err) });
  }
});

// List societies assigned to this admin
router.get('/societies', async (req, res) => {
  const u = await User.findByPk(req.user.id, {
    include: [{ model: Society, as: 'adminSocieties' }],
  });
  const societies = (u && u.adminSocieties) || [];
  res.json({ societies });
});

// Get owners or tenants
router.get('/users', async (req, res) => {
  const { role } = req.query;
  const where = { societyId: req.user.societyId };
  if (role) where.role = role;
  const users = await User.findAll({ where });
  res.json({ users });
});

// Update user
router.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const user = await User.findByPk(id);
  if (!user || user.societyId !== req.user.societyId)
    return res.status(404).json({ error: 'not found' });
  await user.update(req.body);
  // log
  await SuperadminLog.create({
    user_id: req.user.id,
    action_type: 'user_updated',
    details: { userId: user.id, changes: req.body },
  });
  res.json({ user });
});

// Wings/buildings (admin-scoped)
router.get('/buildings', async (req, res) => {
  const buildings = await Building.findAll({ where: { societyId: req.user.societyId } });
  res.json({ buildings });
});

router.post('/buildings', async (req, res) => {
  const { name, address, total_units } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const b = await Building.create({
    name,
    address,
    total_units: total_units || 0,
    societyId: req.user.societyId,
  });
  await SuperadminLog.create({
    user_id: req.user.id,
    action_type: 'building_created',
    details: { buildingId: b.id, name: b.name },
  });
  res.json({ building: b });
});

router.put('/buildings/:id', async (req, res) => {
  const { id } = req.params;
  const b = await Building.findByPk(id);
  if (!b || b.societyId !== req.user.societyId) return res.status(404).json({ error: 'not found' });
  await b.update(req.body);
  await SuperadminLog.create({
    user_id: req.user.id,
    action_type: 'building_updated',
    details: { buildingId: b.id, changes: req.body },
  });
  res.json({ building: b });
});

router.delete('/buildings/:id', async (req, res) => {
  const { id } = req.params;
  const b = await Building.findByPk(id);
  if (!b || b.societyId !== req.user.societyId) return res.status(404).json({ error: 'not found' });
  await b.destroy();
  await SuperadminLog.create({
    user_id: req.user.id,
    action_type: 'building_deleted',
    details: { buildingId: id },
  });
  res.json({ success: true });
});

// Flats (apartments) management
router.get('/flats', async (req, res) => {
  const flats = await Flat.findAll({ where: { societyId: req.user.societyId } });
  res.json({ flats });
});

router.post('/flats', async (req, res) => {
  const { flat_no, ownerId, buildingId } = req.body;
  if (!flat_no) return res.status(400).json({ error: 'flat_no required' });
  const f = await Flat.create({
    flat_no,
    ownerId: ownerId || null,
    buildingId: buildingId || null,
    societyId: req.user.societyId,
  });
  await SuperadminLog.create({
    user_id: req.user.id,
    action_type: 'flat_created',
    details: { flatId: f.id, flat_no: f.flat_no },
  });
  res.json({ flat: f });
});

// Add Wing (building) and auto-generate flats
router.post('/addWing', async (req, res) => {
  try {
    const { name, number_of_floors, flats_per_floor } = req.body;
    if (!name || !number_of_floors || !flats_per_floor)
      return res.status(400).json({ error: 'name, number_of_floors and flats_per_floor required' });
    const b = await Building.create({
      name,
      address: '',
      total_units: Number(number_of_floors) * Number(flats_per_floor),
      total_floors: Number(number_of_floors),
      societyId: req.user.societyId,
    });
    // generate flat numbers like A-101, A-102... or simple numeric per wing
    const createdFlats = [];
    for (let floor = 1; floor <= Number(number_of_floors); floor++) {
      for (let slot = 1; slot <= Number(flats_per_floor); slot++) {
        const flat_no = `${name}-${floor}-${slot}`; // example: WingA-1-1
        // Some DBs may not yet have the buildingId column (migration pending). Check and omit when missing.
        let f;
        try {
          const desc = await Flat.sequelize.getQueryInterface().describeTable('flats');
          if (desc && desc.buildingId) {
            f = await Flat.create({
              societyId: req.user.societyId,
              flat_no,
              ownerId: null,
              buildingId: b.id,
            });
          } else {
            f = await Flat.create({ societyId: req.user.societyId, flat_no, ownerId: null });
          }
        } catch (err) {
          // If describeTable or insert fails for schema reasons, try a minimal create to avoid 500
          try {
            f = await Flat.create({ societyId: req.user.societyId, flat_no, ownerId: null });
          } catch (e2) {
            throw e2;
          }
        }
        createdFlats.push(f);
      }
    }
    await SuperadminLog.create({
      user_id: req.user.id,
      action_type: 'building_created_with_flats',
      details: { buildingId: b.id, created: createdFlats.length },
    });
    res.json({ building: b, flats: createdFlats });
  } catch (e) {
    console.error('addWing failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Get wings
router.get('/getWings', async (req, res) => {
  try {
    const wings = await Building.findAll({ where: { societyId: req.user.societyId } });
    res.json({ wings });
  } catch (e) {
    console.error('getWings failed', e);
    res.status(500).json({ error: 'failed' });
  }
});

// Get flats by wing
router.get('/getFlatsByWing/:wingId', async (req, res) => {
  try {
    const { wingId } = req.params;
    // Ensure the flats table actually has buildingId column (migration may be pending)
    let hasBuildingId = true;
    try {
      const desc = await Flat.sequelize.getQueryInterface().describeTable('flats');
      hasBuildingId = !!desc.buildingId;
    } catch (err) {
      console.warn('describeTable failed', err && err.message);
      hasBuildingId = false;
    }

    if (!hasBuildingId) {
      // Migration not applied — return a helpful error instead of a 500
      return res
        .status(400)
        .json({
          error: 'schema_missing',
          detail: 'flats.buildingId column not found; run migrations',
        });
    }

    const flats = await Flat.findAll({
      where: { buildingId: wingId, societyId: req.user.societyId },
    });
    res.json({ flats });
  } catch (e) {
    console.error('getFlatsByWing failed', e);
    res.status(500).json({ error: 'failed' });
  }
});

// Assign user to flat (owner or tenant)
router.post('/assignUserToFlat', async (req, res) => {
  try {
    const { wingId, flatId, role, name, phone, address, files } = req.body;
    if (!flatId || !role || !phone)
      return res.status(400).json({ error: 'flatId, role and phone required' });
    if (!['owner', 'tenant'].includes(role)) return res.status(400).json({ error: 'invalid role' });

    const phoneClean = String(phone || '').replace(/\D/g, '');
    let user = await User.findOne({ where: { phone: phoneClean } });
    if (!user) {
      user = await User.create({
        name: name || phoneClean,
        phone: phoneClean,
        role,
        societyId: req.user.societyId,
        address: address || '',
      });
    } else {
      // update role if necessary
      if (user.role !== role) await user.update({ role });
    }

    // Owner assignment: ensure flat has no owner
    const flat = await Flat.findByPk(flatId);
    if (!flat || flat.societyId !== req.user.societyId)
      return res.status(404).json({ error: 'flat not found' });
    if (role === 'owner') {
      if (flat.ownerId) {
        return res.status(400).json({ error: 'flat already has an owner' });
      }
      await flat.update({ ownerId: user.id });
      await SuperadminLog.create({
        user_id: req.user.id,
        action_type: 'owner_assigned',
        details: { flatId, ownerId: user.id },
      });
      return res.json({ success: true, flat, user });
    }

    // Tenant assignment: create Agreement linking tenant->flat
    if (role === 'tenant') {
      const ag = await Agreement.create({
        flatId,
        ownerId: flat.ownerId || null,
        tenantId: user.id,
      });
      await SuperadminLog.create({
        user_id: req.user.id,
        action_type: 'tenant_assigned',
        details: { flatId, tenantId: user.id },
      });
      return res.json({ success: true, agreement: ag, user });
    }
  } catch (e) {
    console.error('assignUserToFlat failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Get flat history (agreements + documents + owners/tenants history)
router.get('/getFlatHistory/:flatId', async (req, res) => {
  try {
    const { flatId } = req.params;
    const ags = await Agreement.findAll({ where: { flatId } });
    const docs = await Document.findAll({
      where: { uploaded_by: req.user.id, societyId: req.user.societyId },
    });
    res.json({ agreements: ags, documents: docs });
  } catch (e) {
    console.error('getFlatHistory failed', e);
    res.status(500).json({ error: 'failed' });
  }
});

// Upload owner documents
router.post('/uploadOwnerDocs', async (req, res) => {
  try {
    const { title, file_url, file_type, ownerId } = req.body;
    if (!file_url || !ownerId)
      return res.status(400).json({ error: 'file_url and ownerId required' });
    const doc = await Document.create({
      title,
      file_url,
      file_type,
      uploaded_by: ownerId,
      societyId: req.user.societyId,
    });
    await SuperadminLog.create({
      user_id: req.user.id,
      action_type: 'owner_doc_uploaded',
      details: { ownerId, docId: doc.id },
    });
    res.json({ document: doc });
  } catch (e) {
    console.error('uploadOwnerDocs failed', e);
    res.status(500).json({ error: 'failed' });
  }
});

// Admin: create a notice for this society (can target buildingIds array or targetAll boolean)
router.post('/notices', async (req, res) => {
  try {
    const { title, description, image_url, buildingIds, targetAll } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const notice = await Notice.create({
      title,
      description,
      image_url,
      societyId: req.user.societyId,
      created_by: req.user.id,
    });

    // Determine recipients
    let recipientUserIds = new Set();
    if (targetAll) {
      const Op = require('sequelize').Op;
      const allUsers = await User.findAll({
        where: { societyId: req.user.societyId, role: { [Op.in]: ['owner', 'tenant'] } },
      });
      allUsers.forEach((u) => recipientUserIds.add(String(u.id)));
    } else if (Array.isArray(buildingIds) && buildingIds.length) {
      // find flats in those buildings
      const flats = await Flat.findAll({
        where: { buildingId: buildingIds, societyId: req.user.societyId },
      });
      const flatIds = flats.map((f) => f.id);
      flats.forEach((f) => {
        if (f.ownerId) recipientUserIds.add(String(f.ownerId));
      });
      if (flatIds.length) {
        const ags = await Agreement.findAll({ where: { flatId: flatIds } });
        ags.forEach((a) => {
          if (a.tenantId) recipientUserIds.add(String(a.tenantId));
        });
      }
    }

    // create NoticeRecipient entries for recipients (if any)
    let createdRecipients = [];
    if (recipientUserIds.size) {
      const bulk = Array.from(recipientUserIds).map((uid) => ({
        noticeId: notice.id,
        userId: uid,
        societyId: req.user.societyId,
      }));
      createdRecipients = await NoticeRecipient.bulkCreate(bulk);
    }

    await SuperadminLog.create({
      user_id: req.user.id,
      action_type: 'notice_created',
      details: { noticeId: notice.id, title, recipients: createdRecipients.length || 0 },
    });
    res.json({ notice, recipients: createdRecipients.length || 0 });
  } catch (e) {
    console.error('create notice failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

router.put('/flats/:id', async (req, res) => {
  const { id } = req.params;
  const f = await Flat.findByPk(id);
  if (!f || f.societyId !== req.user.societyId) return res.status(404).json({ error: 'not found' });
  await f.update(req.body);
  await SuperadminLog.create({
    user_id: req.user.id,
    action_type: 'flat_updated',
    details: { flatId: f.id, changes: req.body },
  });
  res.json({ flat: f });
});

router.delete('/flats/:id', async (req, res) => {
  const { id } = req.params;
  const f = await Flat.findByPk(id);
  if (!f || f.societyId !== req.user.societyId) return res.status(404).json({ error: 'not found' });
  await f.destroy();
  await SuperadminLog.create({
    user_id: req.user.id,
    action_type: 'flat_deleted',
    details: { flatId: id },
  });
  res.json({ success: true });
});

// Helplines (services)
router.get('/helplines', async (req, res) => {
  const helplines = await Helpline.findAll({ where: { societyId: req.user.societyId } });
  res.json({ helplines });
});

router.post('/helplines', async (req, res) => {
  const { type, name, phone, notes } = req.body;
  if (!type || !phone) return res.status(400).json({ error: 'type and phone required' });
  const h = await Helpline.create({ type, name, phone, notes, societyId: req.user.societyId });
  await SuperadminLog.create({
    user_id: req.user.id,
    action_type: 'helpline_created',
    details: { helplineId: h.id, type: h.type, phone: h.phone },
  });
  res.json({ helpline: h });
});

router.put('/helplines/:id', async (req, res) => {
  const { id } = req.params;
  const h = await Helpline.findByPk(id);
  if (!h || h.societyId !== req.user.societyId) return res.status(404).json({ error: 'not found' });
  await h.update(req.body);
  await SuperadminLog.create({
    user_id: req.user.id,
    action_type: 'helpline_updated',
    details: { helplineId: h.id, changes: req.body },
  });
  res.json({ helpline: h });
});

router.delete('/helplines/:id', async (req, res) => {
  const { id } = req.params;
  const h = await Helpline.findByPk(id);
  if (!h || h.societyId !== req.user.societyId) return res.status(404).json({ error: 'not found' });
  await h.destroy();
  await SuperadminLog.create({
    user_id: req.user.id,
    action_type: 'helpline_deleted',
    details: { helplineId: id },
  });
  res.json({ success: true });
});

// Dashboard summary
router.get('/summary', async (req, res) => {
  const totalOwners = await User.count({ where: { societyId: req.user.societyId, role: 'owner' } });
  const totalTenants = await User.count({
    where: { societyId: req.user.societyId, role: 'tenant' },
  });
  const totalWings = await Building.count({ where: { societyId: req.user.societyId } });
  const totalHelplines = await Helpline.count({ where: { societyId: req.user.societyId } });
  res.json({ totalOwners, totalTenants, totalWings, totalHelplines });
});

// Upload file (accepts dataUrl or remote URL) -> returns { url }
router.post('/upload', async (req, res) => {
  const { dataUrl, filename } = req.body;
  if (!dataUrl) return res.status(400).json({ error: 'dataUrl required' });
  try {
    // Prefer Cloudinary (configured centrally in app.js)
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
    // no cloudinary -> echo back the dataUrl (caller can store as-is)
    return res.json({ url: dataUrl });
  } catch (e) {
    console.error('upload failed', e.message);
    return res.status(500).json({ error: 'upload failed', detail: e.message });
  }
});

// Logs - recent actions
router.get('/logs', async (req, res) => {
  const logs = await SuperadminLog.findAll({ order: [['createdAt', 'DESC']], limit: 200 });
  res.json({ logs });
});

// Admin: list all complaints for the society (owners and tenants)
router.get('/complaints', async (req, res) => {
  try {
    const complaints = await Complaint.findAll({
      where: { societyId: req.user.societyId },
      order: [['createdAt', 'DESC']],
    });
    res.json({ complaints });
  } catch (e) {
    console.error('admin complaints list failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Documents for a user (owner or tenant)
router.get('/users/:id/documents', async (req, res) => {
  const { id } = req.params;
  const docs = await Document.findAll({
    where: { uploaded_by: id, societyId: req.user.societyId },
  });
  res.json({ documents: docs });
});

// Upload/link document (we accept file_url in body; production should use Cloudinary upload)
router.post('/users/:id/documents', async (req, res) => {
  const { id } = req.params;
  const { title, file_url, file_type } = req.body;
  if (!file_url) return res.status(400).json({ error: 'file_url required' });
  const doc = await Document.create({
    title,
    file_url,
    file_type,
    uploaded_by: id,
    societyId: req.user.societyId,
  });
  await SuperadminLog.create({
    user_id: req.user.id,
    action_type: 'document_uploaded',
    details: { userId: id, docId: doc.id },
  });
  res.json({ document: doc });
});

// Agreements (tenant-owner contracts)
router.post('/agreements', async (req, res) => {
  const { flatId, ownerId, tenantId, file_url, start_date, end_date } = req.body;
  if (!flatId || !ownerId || !tenantId || !file_url)
    return res.status(400).json({ error: 'flatId, ownerId, tenantId and file_url required' });
  const ag = await Agreement.create({ flatId, ownerId, tenantId, file_url, start_date, end_date });
  await SuperadminLog.create({
    user_id: req.user.id,
    action_type: 'agreement_created',
    details: { agreementId: ag.id, flatId, ownerId, tenantId },
  });
  res.json({ agreement: ag });
});

router.get('/agreements', async (req, res) => {
  const ags = await Agreement.findAll({ where: {}, limit: 200 });
  res.json({ agreements: ags });
});

// User history: find actions via documents + agreements
router.get('/users/:id/history', async (req, res) => {
  const { id } = req.params;
  const docs = await Document.findAll({
    where: { uploaded_by: id, societyId: req.user.societyId },
  });
  const agreements = await Agreement.findAll({
    where: { [require('sequelize').Op.or]: [{ ownerId: id }, { tenantId: id }] },
  });
  res.json({ documents: docs, agreements });
});

// Search users by name/phone
router.get('/search/users', async (req, res) => {
  const q = req.query.q || '';
  const Op = require('sequelize').Op;
  const users = await User.findAll({
    where: {
      societyId: req.user.societyId,
      [Op.or]: [{ name: { [Op.iLike]: `%${q}%` } }, { phone: { [Op.iLike]: `%${q}%` } }],
    },
    limit: 100,
  });
  res.json({ users });
});

module.exports = router;

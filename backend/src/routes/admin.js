const express = require('express');
const router = express.Router();
const { User, Flat } = require('../models');
const {
  Building,
  Helpline,
  Camera,
  Document,
  Agreement,
  SuperadminLog,
  Society,
  Notice,
  NoticeRecipient,
  Complaint,
  Bill,
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

// Get owners or tenants grouped by wing and flat
router.get('/users', async (req, res) => {
  try {
    const { role } = req.query;
    const Op = require('sequelize').Op;

    // Fetch wings with flats and their associations
    const wings = await Building.findAll({
      where: { societyId: req.user.societyId },
      include: [
        {
          model: Flat,
          required: false, // Use LEFT JOIN
          include: [
            {
              model: User,
              as: 'owner',
              required: false,
            },
            {
              model: Agreement,
              required: false,
              include: [
                {
                  model: User,
                  as: 'tenant',
                  required: false,
                },
              ],
            },
          ],
        },
      ],
      order: [
        ['name', 'ASC'],
        [Flat, 'flat_no', 'ASC'],
      ], // Order by wing name and flat number
    });

    // Structure the response with proper error handling for null values
    const structuredData = wings
      .map((wing) => {
        // Ensure Flats exists and is an array
        const flats = wing.Flats || [];

        return {
          id: wing.id,
          name: wing.name || `Wing ${wing.id}`,
          flats: flats
            .map((flat) => {
              // Collect tenants from agreements, handling null cases
              const tenants = (flat.Agreements || [])
                .map((agreement) => agreement.tenant)
                .filter((tenant) => tenant !== null);

              return {
                id: flat.id,
                flat_no: flat.flat_no,
                owner: flat.owner || null,
                users: [...(flat.owner ? [flat.owner] : []), ...tenants].filter(
                  (user) => user !== null
                ),
              };
            })
            .filter((flat) => flat !== null),
        };
      })
      .filter((wing) => wing !== null);

    // Log the response size to help debug
    const responseSize = JSON.stringify(structuredData).length;
    console.log(`Returning ${structuredData.length} wings with data size ${responseSize} bytes`);

    res.json({ wings: structuredData });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({
      error: 'Failed to fetch users',
      detail: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
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
    // derive a short prefix for flat numbers: prefer a single label like 'B' when admin used 'Wing B' or 'Block B'
    let prefix = String(name || '').trim();
    try {
      // remove common leading words like 'wing', 'block', 'building'
      prefix = prefix.replace(/^(wing|block|building)\s+/i, '').trim();
      if (!prefix) prefix = String(name || '').trim();
    } catch (e) {}
    // generate flat numbers like A-101, A-102... or simple numeric per wing
    const createdFlats = [];
    for (let floor = 1; floor <= Number(number_of_floors); floor++) {
      for (let slot = 1; slot <= Number(flats_per_floor); slot++) {
        // Format flat numbers like B-101, B-102, ... B-201, etc.
        // Use floor as the hundreds place and slot as the last two digits (padded)
        const slotPadded = String(slot).padStart(2, '0');
        const flat_no = `${prefix}-${floor}${slotPadded}`; // example: B-101
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
      return res.status(400).json({
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

// Cameras: list cameras for this admin's society
router.get('/cameras', async (req, res) => {
  try {
    const CameraModel = require('../models').Camera;
    const cams = await CameraModel.findAll({ where: { societyId: req.user.societyId } });
    res.json({ cameras: cams });
  } catch (e) {
    console.error('list cameras failed', e && e.message);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Add camera
router.post('/cameras', async (req, res) => {
  try {
    const { name, ip_address, port, username, password, rtsp_path, is_active } = req.body;
    if (!name || !ip_address || !username || !password)
      return res.status(400).json({ error: 'name, ip_address, username and password required' });
    const CameraModel = require('../models').Camera;
    const cam = await CameraModel.create({
      societyId: req.user.societyId,
      name,
      ip_address,
      port: port || 554,
      username,
      password,
      rtsp_path: rtsp_path || 'cam/realmonitor?channel=1&subtype=0',
      is_active: typeof is_active === 'boolean' ? is_active : true,
    });
    await SuperadminLog.create({
      user_id: req.user.id,
      action_type: 'camera_created',
      details: { cameraId: cam.id, name: cam.name },
    });
    res.json({ camera: cam });
  } catch (e) {
    console.error('create camera failed', e && e.message);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Test camera RTSP connection (uses ffmpeg if available)
router.post('/cameras/test', async (req, res) => {
  try {
    const { ip_address, port, username, password, rtsp_path } = req.body;
    if (!ip_address || !username || !password)
      return res.status(400).json({ error: 'ip_address, username and password required' });
    const rtspUrl = `rtsp://${username}:${password}@${ip_address}:${port || 554}/${
      rtsp_path || ''
    }`;
    const { exec } = require('child_process');
    // Try a short ffmpeg probe (2 seconds). If ffmpeg is not installed, return unsupported.
    exec(`ffmpeg -i "${rtspUrl}" -t 2 -f null -`, { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) {
        console.warn('ffmpeg test failed', err && err.message);
        return res
          .status(400)
          .json({ ok: false, message: 'Connection failed', detail: stderr || err.message });
      }
      return res.json({ ok: true, message: 'Connection successful' });
    });
  } catch (e) {
    console.error('test camera failed', e && e.message);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
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

// Staff management (create/list/update/delete)
router.get('/staff', async (req, res) => {
  try {
    const Staff = require('../models').Staff;
    const staff = await Staff.findAll({ where: { societyId: req.user.societyId } });
    res.json({ staff });
  } catch (e) {
    console.error('list staff failed', e && e.message);
    res.status(500).json({ error: 'failed' });
  }
});

router.post('/staff', async (req, res) => {
  try {
    const Staff = require('../models').Staff;
    const { name, staffType, phone, wingId, status, aadhaarUrl, role } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const s = await Staff.create({
      name,
      staffType: staffType || null,
      phone: phone || null,
      wingId: wingId || null,
      status: status || 'active',
      aadhaarUrl: aadhaarUrl || null,
      societyId: req.user.societyId,
    });
    // If caller requested role=security_guard, create a linked User so the guard can login.
    if (role === 'security_guard') {
      try {
        const User = require('../models').User;
        const phoneClean = String(phone || '').replace(/\D/g, '');
        let existing = null;
        if (phoneClean) existing = await User.findOne({ where: { phone: phoneClean } });
        if (!existing && phoneClean) {
          // create a basic user record; password/login via OTP flow already exists in auth
          const user = await User.create({
            name: name || phoneClean,
            phone: phoneClean,
            role: 'security_guard',
            societyId: req.user.societyId,
          });
          await SuperadminLog.create({
            user_id: req.user.id,
            action_type: 'security_guard_user_created',
            details: { staffId: s.id, userId: user.id },
          });
        }
      } catch (e) {
        console.warn('creating linked security guard user failed', e && e.message);
      }
    }
    await SuperadminLog.create({
      user_id: req.user.id,
      action_type: 'staff_created',
      details: { staffId: s.id, name: s.name },
    });
    res.json({ staff: s });
  } catch (e) {
    console.error('create staff failed', e && e.message);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

router.put('/staff/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const Staff = require('../models').Staff;
    const s = await Staff.findByPk(id);
    if (!s || s.societyId !== req.user.societyId)
      return res.status(404).json({ error: 'not found' });
    await s.update(req.body);
    await SuperadminLog.create({
      user_id: req.user.id,
      action_type: 'staff_updated',
      details: { staffId: s.id, changes: req.body },
    });
    res.json({ staff: s });
  } catch (e) {
    console.error('update staff failed', e && e.message);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

router.delete('/staff/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const Staff = require('../models').Staff;
    const s = await Staff.findByPk(id);
    if (!s || s.societyId !== req.user.societyId)
      return res.status(404).json({ error: 'not found' });
    await s.destroy();
    await SuperadminLog.create({
      user_id: req.user.id,
      action_type: 'staff_deleted',
      details: { staffId: id },
    });
    res.json({ success: true });
  } catch (e) {
    console.error('delete staff failed', e && e.message);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
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

// Visitors: list and get
router.get('/visitors', async (req, res) => {
  try {
    const db = require('../models');
    const { Op } = require('sequelize');
    const { wingId, flatNumber, gateId, q, from, to, period, limit } = req.query;

    const where = {};
    if (gateId) where.gateId = gateId;
    if (q) where.mainVisitorName = { [Op.iLike]: `%${q}%` };

    // date range handling
    let dateFrom = null;
    let dateTo = null;
    if (from) dateFrom = new Date(String(from));
    if (to) dateTo = new Date(String(to));
    if (!dateFrom && !dateTo && period) {
      const now = new Date();
      if (period === 'daily') {
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (period === 'weekly') {
        dateFrom = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      } else if (period === 'monthly') {
        dateFrom = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      }
    }
    if (dateFrom && dateTo) where.checkInTime = { [Op.between]: [dateFrom, dateTo] };
    else if (dateFrom) where.checkInTime = { [Op.gte]: dateFrom };
    else if (dateTo) where.checkInTime = { [Op.lte]: dateTo };

    const include = [];
    // include wing and flat for richer filtering / response
    include.push({ model: db.Building, as: 'wing', required: false });
    if (flatNumber) {
      include.push({ model: db.Flat, required: true, where: { flat_no: String(flatNumber) } });
    } else {
      include.push({ model: db.Flat, required: false });
    }

    const items = await db.Visitor.findAll({
      where,
      include,
      order: [['checkInTime', 'DESC']],
      limit: Number(limit || 500),
    });
    res.json({ visitors: items });
  } catch (e) {
    console.error('list visitors failed', e && e.stack ? e.stack : e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

router.get('/visitors/:id', async (req, res) => {
  try {
    const db = require('../models');
    const { id } = req.params;
    const v = await db.Visitor.findByPk(id, {
      include: [{ model: db.Building, as: 'wing' }, { model: db.Flat }],
    });
    if (!v) return res.status(404).json({ error: 'not found' });
    res.json({ visitor: v });
  } catch (e) {
    console.error('get visitor failed', e && e.stack ? e.stack : e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Admin: maintenance fees summary grouped by owner (raiser)
// Query params:
// - month=YYYY-MM (optional, defaults to current month)
// - status=paid|unpaid|all (optional, defaults to all)
router.get('/maintenance-fees', async (req, res) => {
  try {
    const { month, status } = req.query;
    const Op = require('sequelize').Op;

    // compute month range
    let startDate, endDate;
    if (month) {
      // expect YYYY-MM
      const parts = String(month).split('-');
      if (parts.length !== 2) return res.status(400).json({ error: 'month must be YYYY-MM' });
      const [y, m] = parts.map((p) => Number(p));
      if (!y || !m || m < 1 || m > 12) return res.status(400).json({ error: 'invalid month' });
      startDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
      endDate = new Date(Date.UTC(y, m, 1, 0, 0, 0)); // exclusive
    } else {
      const now = new Date();
      startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
      endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
    }

    const where = { societyId: req.user.societyId };
    // Only include bills raised by this admin (raised_by)
    where.raised_by = req.user.id;
    where.createdAt = { [Op.gte]: startDate, [Op.lt]: endDate };

    // status filter: consider 'closed' as paid
    let statusFilter = null;
    if (status === 'paid') statusFilter = { status: 'closed' };
    else if (status === 'unpaid') statusFilter = { status: { [Op.ne]: 'closed' } };
    if (statusFilter) Object.assign(where, statusFilter);

    // fetch bills in the month for this society (include raiser info)
    const bills = await Bill.findAll({
      where,
      include: [
        { model: User, as: 'raiser', attributes: ['id', 'name', 'phone'] },
        { model: User, as: 'assignee', attributes: ['id', 'name', 'phone'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: 5000,
    });

    // group by raiser (raised_by) OR by assignee for maintenance-type bills
    // If bill.type === 'maintenance' we group by assigned_to (owner), otherwise by raiser.
    const groupsMap = {};
    let totalAmount = 0;
    let totalPaid = 0;
    let totalCount = 0;

    bills.forEach((b) => {
      const cost = Number(b.cost) || 0;
      totalAmount += cost;
      const isPaid = String(b.status).toLowerCase() === 'closed';
      if (isPaid) totalPaid += cost;
      totalCount += 1;

      // choose grouping key & label depending on bill type
      let groupKey, labelId, labelName, labelPhone;
      if (String(b.type).toLowerCase() === 'maintenance') {
        // group by assignee (owner)
        labelId = (b.assignee && b.assignee.id) || b.assigned_to || 'unknown';
        labelName = (b.assignee && b.assignee.name) || 'Unknown Owner';
        labelPhone = (b.assignee && b.assignee.phone) || null;
        groupKey = String(labelId || 'unknown');
      } else {
        labelId = (b.raiser && b.raiser.id) || b.raised_by || 'unknown';
        labelName = (b.raiser && b.raiser.name) || 'Unknown';
        labelPhone = (b.raiser && b.raiser.phone) || null;
        groupKey = String(labelId || 'unknown');
      }

      if (!groupsMap[groupKey]) {
        groupsMap[groupKey] = {
          id: labelId,
          name: labelName,
          phone: labelPhone,
          totalBills: 0,
          totalAmount: 0,
          paidAmount: 0,
          unpaidAmount: 0,
          bills: [],
        };
      }

      groupsMap[groupKey].totalBills += 1;
      groupsMap[groupKey].totalAmount += cost;
      if (isPaid) groupsMap[groupKey].paidAmount += cost;
      else groupsMap[groupKey].unpaidAmount += cost;
      groupsMap[groupKey].bills.push({
        id: b.id,
        title: b.title,
        description: b.description,
        cost: cost,
        type: b.type,
        status: b.status,
        assigned_to: b.assigned_to,
        payment_proof_url: b.payment_proof_url,
        createdAt: b.createdAt,
      });
    });

    const groups = Object.keys(groupsMap).map((k) => groupsMap[k]);

    res.json({
      totals: {
        totalAmount,
        totalPaid,
        totalUnpaid: totalAmount - totalPaid,
        totalCount,
      },
      groups,
    });
  } catch (e) {
    console.error('maintenance-fees failed', e && e.stack);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Admin: list bills for this society (with optional filters)
// Query params: month=YYYY-MM, status=closed|open|payment_pending|all, ownerId (assigned_to)
router.get('/bills', async (req, res) => {
  try {
    const { month, status, ownerId } = req.query;
    const Op = require('sequelize').Op;
    const where = { societyId: req.user.societyId };

    if (status && status !== 'all') {
      where.status = status;
    }

    if (ownerId) where.assigned_to = ownerId;

    if (month) {
      const parts = String(month).split('-');
      if (parts.length === 2) {
        const [y, m] = parts.map((p) => Number(p));
        if (y && m) {
          const startDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
          const endDate = new Date(Date.UTC(y, m, 1, 0, 0, 0));
          where.createdAt = { [Op.gte]: startDate, [Op.lt]: endDate };
        }
      }
    }

    const bills = await Bill.findAll({
      where,
      include: [
        { model: User, as: 'raiser', attributes: ['id', 'name', 'phone'] },
        { model: User, as: 'assignee', attributes: ['id', 'name', 'phone'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: 5000,
    });
    res.json({ bills });
  } catch (e) {
    console.error('admin list bills failed', e && e.stack);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Admin: get/set maintenance setting for this society
router.get('/maintenance-settings', async (req, res) => {
  try {
    const setting = await require('../models').MaintenanceSetting.findOne({
      where: { societyId: req.user.societyId },
    });
    res.json({ setting });
  } catch (e) {
    console.error('get maintenance settings failed', e && e.message);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

router.post('/maintenance-settings', async (req, res) => {
  try {
    const { amount, effective_from } = req.body;
    if (amount === undefined || amount === null)
      return res.status(400).json({ error: 'amount required' });
    const MaintenanceSetting = require('../models').MaintenanceSetting;
    let setting = await MaintenanceSetting.findOne({ where: { societyId: req.user.societyId } });
    if (setting) {
      await setting.update({ amount: Number(amount) || 0, effective_from: effective_from || null });
    } else {
      setting = await MaintenanceSetting.create({
        societyId: req.user.societyId,
        amount: Number(amount) || 0,
        effective_from: effective_from || null,
      });
    }
    res.json({ setting });
  } catch (e) {
    console.error('set maintenance settings failed', e && e.message);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Admin: generate monthly maintenance bills for all owners
// body: { month: 'YYYY-MM' (optional), amount: integer (optional override) }
router.post('/generate-monthly-maintenance', async (req, res) => {
  try {
    const { month, amount, ownersOnly } = req.body || {};
    const Op = require('sequelize').Op;
    // determine month range
    let startDate, endDate, monthLabel;
    if (month) {
      const parts = String(month).split('-');
      if (parts.length !== 2) return res.status(400).json({ error: 'month must be YYYY-MM' });
      const [y, m] = parts.map((p) => Number(p));
      startDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
      endDate = new Date(Date.UTC(y, m, 1, 0, 0, 0));
      monthLabel = `${y}-${String(m).padStart(2, '0')}`;
    } else {
      const now = new Date();
      startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
      endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
      monthLabel = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    }

    // resolve amount: override, otherwise from MaintenanceSetting
    let finalAmount = amount;
    if (finalAmount === undefined || finalAmount === null) {
      const MaintenanceSetting = require('../models').MaintenanceSetting;
      const setting = await MaintenanceSetting.findOne({
        where: { societyId: req.user.societyId },
      });
      finalAmount = setting ? Number(setting.amount) || 0 : 0;
    }

    // fetch society members: either owners only or owners+tenants
    let membersWhere = { societyId: req.user.societyId };
    if (ownersOnly) {
      membersWhere.role = 'owner';
    } else {
      membersWhere.role = { [Op.in]: ['owner', 'tenant'] };
    }
    const members = await User.findAll({ where: membersWhere });
    const created = [];
    const skipped = [];
    for (const owner of members) {
      // skip if a maintenance bill already exists for the owner in this month
      const exists = await Bill.findOne({
        where: {
          societyId: req.user.societyId,
          assigned_to: owner.id,
          type: 'maintenance',
          createdAt: { [Op.gte]: startDate, [Op.lt]: endDate },
        },
      });
      if (exists) {
        skipped.push({ ownerId: owner.id });
        continue;
      }
      const b = await Bill.create({
        title: `Monthly Maintenance - ${monthLabel}`,
        description: `Maintenance for ${monthLabel}`,
        type: 'maintenance',
        status: 'open',
        cost: Number(finalAmount) || 0,
        societyId: req.user.societyId,
        raised_by: req.user.id,
        assigned_to: owner.id,
      });
      created.push(b);
    }

    res.json({ created: created.length, skipped: skipped.length, items: created.slice(0, 200) });
  } catch (e) {
    console.error('generate monthly maintenance failed', e && e.stack);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Admin: verify a bill (mark paid/mark unpaid)
router.post('/bills/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'approve' | 'reject'
    if (!['approve', 'reject'].includes(action))
      return res.status(400).json({ error: 'invalid action' });
    const bill = await Bill.findByPk(id);
    if (!bill || bill.societyId !== req.user.societyId)
      return res.status(404).json({ error: 'not found' });
    if (action === 'approve') await bill.update({ status: 'closed' });
    else await bill.update({ status: 'open' });
    res.json({ bill });
  } catch (e) {
    console.error('admin verify bill failed', e && e.stack);
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
  try {
    const { flatId, flatIds } = req.query;
    const where = {};
    if (flatId) where.flatId = flatId;
    else if (flatIds) {
      // allow comma-separated list
      const ids = String(flatIds)
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
      if (ids.length) where.flatId = ids;
    }
    const ags = await Agreement.findAll({ where, limit: 200 });
    res.json({ agreements: ags });
  } catch (e) {
    console.error('list agreements failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
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

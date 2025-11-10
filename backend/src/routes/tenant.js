const express = require('express');
const router = express.Router();
const { Complaint, Bill } = require('../models');
const { Op } = require('sequelize');
const { authenticate } = require('../middlewares/auth');
const cloudinary = require('cloudinary').v2;
// multer for multipart/form-data uploads (memory storage)
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
// streamifier is optional but recommended (used to stream buffers to Cloudinary)
let streamifier;
try {
  streamifier = require('streamifier');
} catch (err) {
  console.warn(
    '[tenant] streamifier not installed; install with `npm i streamifier` to enable safe streaming uploads to Cloudinary'
  );
  streamifier = null;
}

// cloudinary is configured centrally in app.js if env vars present
try {
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({ secure: true });
  }
} catch (e) {}

// Helper: upload a data URL or buffer to Cloudinary using upload_stream when needed.
// This avoids cases where the Cloudinary client may try to open long/invalid paths
// (on Windows this can surface as ENAMETOOLONG when a data URL is treated as a path).
async function cloudinaryUploadDataUrl(dataUrlOrBuffer, opts = {}) {
  // if cloudinary isn't configured, surface an error so callers can fallback
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    throw new Error('cloudinary_not_configured');
  }

  // If caller passed a Buffer, stream it directly
  if (Buffer.isBuffer(dataUrlOrBuffer)) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(opts, (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
      streamifier.createReadStream(dataUrlOrBuffer).pipe(uploadStream);
    });
  }

  // If caller passed a data URL (data:...;base64,AAA...), convert to buffer and stream
  if (typeof dataUrlOrBuffer === 'string' && dataUrlOrBuffer.indexOf('data:') === 0) {
    const parts = dataUrlOrBuffer.split(',');
    const meta = parts[0] || '';
    const base64 = parts[1] || '';
    const buffer = Buffer.from(base64, 'base64');
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(opts, (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
      streamifier.createReadStream(buffer).pipe(uploadStream);
    });
  }

  // Fallback: let cloudinary try to handle (remote URL or other). Keep original call.
  return cloudinary.uploader.upload(dataUrlOrBuffer, opts);
}

// Tenant routes: list/create maintenance & complaints under /api
router.use(authenticate);

// Helper to stringify Sequelize errors with useful inner fields
function formatDbError(err) {
  try {
    const out = {
      message: err && err.message,
      name: err && err.name,
      stack: err && err.stack,
      original:
        err && err.original && (err.original.message || err.original.detail || err.original),
      parent: err && err.parent && (err.parent.message || err.parent.detail || err.parent),
    };
    return out;
  } catch (e) {
    return { error: String(err) };
  }
}

// Flats: allow guards/tenants to list flats in their society (includes owner and tenant info)
router.get('/flats', async (req, res) => {
  try {
    const db = require('../models');
    const { Flat, Agreement, User, Building } = db;
    // fetch flats with owner relation
    const flats = await Flat.findAll({
      where: { societyId: req.user.societyId },
      include: [
        {
          model: User,
          as: 'owner',
          required: false,
          attributes: ['id', 'name', 'phone', 'avatar'],
        },
      ],
      order: [['flat_no', 'ASC']],
    });

    // attach tenant info by finding the latest agreement for each flat (if any)
    const out = [];
    for (const f of flats) {
      const plain = f.get ? f.get({ plain: true }) : f;
      let tenant = null;
      let building = null;
      try {
        const ag = await Agreement.findOne({
          where: { flatId: f.id },
          order: [['createdAt', 'DESC']],
        });
        if (ag && ag.tenantId)
          tenant = await User.findByPk(ag.tenantId, { attributes: ['id', 'name', 'phone'] });
      } catch (e) {
        // ignore
      }
      try {
        if (plain.buildingId) building = await Building.findByPk(plain.buildingId);
      } catch (e) {}

      // normalize shape expected by mobile client
      const owner_name = (plain.owner && plain.owner.name) || plain.owner_name || null;
      const tenant_name = (tenant && tenant.name) || plain.tenant_name || null;
      const contact_no = (plain.owner && plain.owner.phone) || plain.contact_no || null;

      out.push({
        ...plain,
        tenant: tenant || null,
        building: building ? (building.get ? building.get({ plain: true }) : building) : null,
        buildingName: building ? building.name || null : null,
        wingName: building ? building.name || null : null,
        wingId: building ? building.id : plain.buildingId || null,
        owner_name,
        tenant_name,
        contact_no,
      });
    }
    res.json({ flats: out });
  } catch (e) {
    console.error('tenant list flats failed', e && e.stack ? e.stack : e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Buildings/Wings: list wings for this society
router.get('/getWings', async (req, res) => {
  try {
    const db = require('../models');
    const wings = await db.Building.findAll({ where: { societyId: req.user.societyId } });
    res.json({ wings });
  } catch (e) {
    console.error('tenant getWings failed', e && e.stack ? e.stack : e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Users: return wings->flats->users structure similar to admin/users but tenant-scoped.
router.get('/users', async (req, res) => {
  try {
    const db = require('../models');
    const { Building, Flat, User, Agreement } = db;
    const wings = await Building.findAll({
      where: { societyId: req.user.societyId },
      include: [
        {
          model: Flat,
          required: false,
          include: [
            { model: User, as: 'owner', required: false },
            { model: Agreement, required: false },
          ],
        },
      ],
      order: [
        ['name', 'ASC'],
        [Flat, 'flat_no', 'ASC'],
      ],
    });

    // Normalize into wings -> flats -> users (deduplicated) as admin route does
    const out = (wings || []).map((w) => {
      const flatsRaw = (w.Flats || []).map((f) => {
        const tenants = (f.Agreements || []).map((a) => a.tenantId).filter(Boolean);
        // fetch tenant objects for found tenantIds
        return {
          id: f.id,
          flat_no: f.flat_no,
          owner: f.owner || null,
          tenantIds: tenants,
        };
      });

      // Resolve tenant objects for tenantIds in bulk (to avoid N+1 we will fetch unique tenant ids)
      const tenantIdSet = new Set();
      flatsRaw.forEach((fr) => (fr.tenantIds || []).forEach((t) => tenantIdSet.add(t)));
      const tenantIds = Array.from(tenantIdSet);
      let tenantMap = {};
      if (tenantIds.length) {
        // Fetch tenants
        // eslint-disable-next-line no-unused-vars
        tenantMap = (async () => {
          const users = await User.findAll({ where: { id: tenantIds } });
          const m = {};
          (users || []).forEach((u) => (m[u.id] = u.get ? u.get({ plain: true }) : u));
          return m;
        })();
      }

      // Build flats array with users array
      const flats = flatsRaw.map((fr) => {
        const users = [];
        if (fr.owner) users.push(fr.owner.get ? fr.owner.get({ plain: true }) : fr.owner);
        // attach tenants if available (resolve from tenantMap promise)
        return { ...fr, users };
      });

      return { id: w.id, name: w.name || `Wing ${w.id}`, flats };
    });

    // The above contains promises for tenantMap; resolve tenant objects synchronously per-flat to keep shape simple
    // For simplicity: fetch agreements per flat to attach tenant objects directly
    for (const wing of out) {
      for (const flat of wing.flats) {
        try {
          const ags = await Agreement.findAll({ where: { flatId: flat.id } });
          for (const ag of ags) {
            if (ag.tenantId) {
              const u = await User.findByPk(ag.tenantId);
              if (u) flat.users.push(u.get ? u.get({ plain: true }) : u);
            }
          }
        } catch (e) {}
        // deduplicate users in flat
        const seen = new Map();
        const uniq = [];
        for (const u of flat.users || []) {
          const key = u && (u.id || u.phone || (u.name && u.name.trim()) || JSON.stringify(u));
          if (!key) continue;
          if (!seen.has(key)) {
            seen.set(key, true);
            uniq.push(u);
          }
        }
        flat.users = uniq;
      }
    }

    res.json({ wings: out });
  } catch (e) {
    console.error('tenant users list failed', e && e.stack ? e.stack : e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Visitors: allow guards or authenticated users to create/list/checkout visitors
router.get('/visitors', async (req, res) => {
  try {
    const db = require('../models');
    const { Op } = require('sequelize');
    const { status, q, flatId, wingId, limit } = req.query;
    // helper: check whether visitors table has a societyId column (some DBs/migrations may be missing)
    const visitorsTableHasSocietyId = async () => {
      const qi = db.sequelize.getQueryInterface();
      const candidates = ['Visitors', 'visitors'];
      for (const t of candidates) {
        try {
          const desc = await qi.describeTable(t);
          if (desc && desc.societyId) return true;
        } catch (e) {
          // ignore and try next
        }
      }
      return false;
    };

    // normalize wingId: clients may send wing name/label instead of UUID
    const isUuid = (v) =>
      typeof v === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
    let resolvedWingId = wingId;
    try {
      if (wingId && !isUuid(wingId)) {
        const b = await db.Building.findOne({
          where: { societyId: req.user.societyId, name: String(wingId) },
        });
        if (b) resolvedWingId = b.id;
      }
    } catch (e) {}
    const hasSocietyId = await visitorsTableHasSocietyId();
    const where = hasSocietyId ? { societyId: req.user.societyId } : {};
    if (status) where.status = String(status);
    if (flatId) where.flatId = String(flatId);
    if (resolvedWingId) where.wingId = String(resolvedWingId);
    if (q) where.mainVisitorName = { [Op.iLike]: `%${String(q)}%` };

    const include = [
      { model: db.Flat, required: false },
      { model: db.Building, as: 'wing', required: false },
    ];
    // Log query filter for debugging
    console.log('[tenant/visitors] findAll where=', JSON.stringify(where));
    const items = await db.Visitor.findAll({
      where,
      include,
      order: [['checkInTime', 'DESC']],
      limit: Number(limit || 500),
    });
    res.json({ visitors: items });
  } catch (e) {
    console.error('list visitors (tenant) failed', formatDbError(e));
    // expose the DB error message to client for easier debugging (not ideal for prod)
    res.status(500).json({ error: 'failed', detail: e && e.message, db: formatDbError(e) });
  }
});

router.post('/visitors', async (req, res) => {
  try {
    const db = require('../models');
    const {
      mainVisitorName,
      selfie,
      flatId,
      wingId,
      reason,
      numberOfPeople,
      additionalVisitors,
      additionalSelfies,
      gateId,
      visitorIdGenerated,
      checkInTime,
    } = req.body || {};

    if (!mainVisitorName) return res.status(400).json({ error: 'mainVisitorName required' });

    // If wingId was provided as a human label (e.g. 'A' or 'Wing A'), try to resolve to Building.id
    const isUuid = (v) =>
      typeof v === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
    let useFlatId = flatId;
    let useWingId = wingId;
    try {
      if (wingId && !isUuid(wingId)) {
        const b = await db.Building.findOne({
          where: { societyId: req.user.societyId, name: String(wingId) },
        });
        if (b) useWingId = b.id;
        else useWingId = null;
      }
    } catch (e) {}

    if (!useFlatId && !useWingId)
      return res.status(400).json({ error: 'flatId or wingId required' });

    // Log incoming payload for debugging (helps identify type mismatches)
    try {
      console.log(
        '[tenant/visitors] create payload',
        JSON.stringify({
          mainVisitorName,
          flatId,
          wingId,
          numberOfPeople,
          visitorIdGenerated,
        }).slice(0, 2000)
      );
    } catch (e) {}

    // Only include societyId if the visitors table actually has that column (migration may be pending)
    const qi = db.sequelize.getQueryInterface();
    let hasSocietyId = false;
    try {
      const candidates = ['Visitors', 'visitors'];
      for (const t of candidates) {
        try {
          const desc = await qi.describeTable(t);
          if (desc && desc.societyId) {
            hasSocietyId = true;
            break;
          }
        } catch (e) {}
      }
    } catch (e) {}

    // Build payload. If the visitors table has a societyId column, set it server-side
    // to the current user's societyId so visitors created by guards/tenants are visible
    // in later queries that filter by societyId.
    // NOTE: when migrations are in-progress the create below will retry without societyId
    // if the DB does not actually have the column (see error handling below).
    const payload = {
      mainVisitorName,
      selfie: selfie || null,
      flatId: useFlatId || null,
      wingId: useWingId || null,
      reason: reason || null,
      numberOfPeople: numberOfPeople ? Number(numberOfPeople) : null,
      additionalVisitors: additionalVisitors || null,
      visitorIdGenerated: visitorIdGenerated || null,
      gateId: gateId || null,
      // include societyId when possible so created visitors are scoped correctly
      ...(hasSocietyId ? { societyId: req.user.societyId } : {}),
      checkInTime: checkInTime ? new Date(checkInTime) : new Date(),
      status: 'IN',
    };

    // Ensure Sequelize only writes the fields we explicitly set (avoid inserting model attrs not present in payload)
    const fieldsToWrite = Object.keys(payload || {});
    let v;
    try {
      v = await db.Visitor.create(payload, { fields: fieldsToWrite });
    } catch (createErr) {
      // If DB complains about missing societyId column, retry without societyId as a fallback
      try {
        const msg =
          (createErr && (createErr.message || createErr.original || createErr.parent || '') + '') ||
          '';
        if (String(msg).toLowerCase().includes('societyid')) {
          try {
            // remove societyId and retry
            const fallbackPayload = { ...payload };
            delete fallbackPayload.societyId;
            const fallbackFields = Object.keys(fallbackPayload || {});
            console.warn(
              '[tenant/visitors] retrying create without societyId due to DB schema mismatch'
            );
            v = await db.Visitor.create(fallbackPayload, { fields: fallbackFields });
          } catch (retryErr) {
            throw retryErr;
          }
        } else {
          throw createErr;
        }
      } catch (outerErr) {
        throw outerErr;
      }
    }

    // respond with created visitor
    res.json({ visitor: v });
  } catch (e) {
    console.error('create visitor failed', formatDbError(e));
    res.status(500).json({ error: 'failed', detail: e && e.message, db: formatDbError(e) });
  }
});

router.patch('/visitors/:id', async (req, res) => {
  try {
    const db = require('../models');
    const { id } = req.params;
    const v = await db.Visitor.findByPk(id);
    if (!v) return res.status(404).json({ error: 'not found' });
    if (v.societyId && req.user && String(v.societyId) !== String(req.user.societyId))
      return res.status(404).json({ error: 'not found' });

    const allowed = ['status', 'checkoutTime', 'reason', 'numberOfPeople', 'additionalVisitors'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    // if status set to OUT and no checkoutTime, set checkoutTime now
    if (updates.status && String(updates.status).toUpperCase() === 'OUT' && !updates.checkoutTime)
      updates.checkoutTime = new Date();

    await v.update(updates);
    res.json({ visitor: v });
  } catch (e) {
    console.error('update visitor failed', e && e.stack ? e.stack : e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// List maintenance requests raised by current user
router.get('/maintenance', async (req, res) => {
  try {
    // Fetch tenant-raised complaints
    const complaints = await Complaint.findAll({
      where: { societyId: req.user.societyId, raised_by: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    // Fetch bills assigned to this tenant
    const bills = await Bill.findAll({
      where: { societyId: req.user.societyId, assigned_to: req.user.id },
      order: [['createdAt', 'DESC']],
    });

    // Combine complaints and bills so tenant sees both under the maintenance view
    const combined = [
      ...bills.map((b) => ({ ...(b.get ? b.get({ plain: true }) : b), _type: 'bill' })),
      ...complaints.map((c) => ({ ...(c.get ? c.get({ plain: true }) : c), _type: 'complaint' })),
    ];

    // sort combined by createdAt descending
    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ maintenance: combined });
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
    // debug: log incoming upload size and filename to assist troubleshooting
    try {
      const len = typeof dataUrl === 'string' ? dataUrl.length : 0;
      console.log(`[tenant/upload] incoming upload: filename=${filename || 'unknown'} size=${len}`);
    } catch (e) {}
    if (
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    ) {
      const opts = { folder: 'society_karbhar' };
      if (process.env.CLOUDINARY_UPLOAD_PRESET)
        opts.upload_preset = process.env.CLOUDINARY_UPLOAD_PRESET;
      if (filename) opts.public_id = filename.replace(/\.[^/.]+$/, '');
      const result = await cloudinaryUploadDataUrl(dataUrl, opts);
      return res.json({ url: result && result.secure_url });
    }
    return res.json({ url: dataUrl });
  } catch (e) {
    console.error('tenant upload failed', e && e.message, e && e.stack, e);
    return res.status(500).json({ error: 'upload failed', detail: e && (e.message || e) });
  }
});

// Upload endpoint that accepts multipart/form-data (file field `file`) -> { url }
router.post('/upload_form', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'file required' });
    try {
      console.log(
        '[tenant/upload_form] received file:',
        file.originalname,
        file.mimetype,
        'size=',
        file.size || (file.buffer && file.buffer.length)
      );
    } catch (e) {}
    // Proceed to handle the uploaded file. (Earlier accidental early-return/logging removed.)
    if (
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    ) {
      const opts = { folder: 'society_karbhar' };
      if (process.env.CLOUDINARY_UPLOAD_PRESET)
        opts.upload_preset = process.env.CLOUDINARY_UPLOAD_PRESET;
      // convert buffer to dataUrl and upload via cloudinary.uploader.upload
      const dataUrl = `data:${
        file.mimetype || 'application/octet-stream'
      };base64,${file.buffer.toString('base64')}`;
      const result = await cloudinaryUploadDataUrl(dataUrl, opts);
      console.log('[tenant/upload_form] uploaded to cloudinary', result && result.secure_url);
      return res.json({ url: result && result.secure_url });
    }

    // fallback: return a data URL so client can still use the file
    const base64 = file.buffer.toString('base64');
    const mime = file.mimetype || 'application/octet-stream';
    return res.json({ url: `data:${mime};base64,${base64}` });
  } catch (e) {
    console.error('tenant upload_form failed', e && e.message, e && e.stack);
    return res.status(500).json({
      error: 'upload failed',
      detail: e && e.message,
      stack: process.env.NODE_ENV !== 'production' ? e && e.stack : undefined,
    });
  }
});

// Upload and save avatar for current authenticated user (multipart/form-data -> file)
// Returns updated user record: { user }
router.post('/user/avatar', upload.single('file'), async (req, res) => {
  try {
    // Log incoming request for debugging connectivity issues
    try {
      console.log('[user/avatar] incoming request from ip=', req.ip, 'headers=', {
        host: req.headers.host,
        'user-agent': req.headers['user-agent'],
        authorization: !!req.headers.authorization,
      });
    } catch (e) {}

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'file required' });
    try {
      console.log(
        '[user/avatar] received file:',
        file.originalname,
        file.mimetype,
        'size=',
        file.size || (file.buffer && file.buffer.length)
      );
    } catch (e) {}

    let url = null;
    if (
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    ) {
      const opts = { folder: 'society_karbhar/avatars' };
      if (process.env.CLOUDINARY_UPLOAD_PRESET)
        opts.upload_preset = process.env.CLOUDINARY_UPLOAD_PRESET;
      const dataUrl = `data:${
        file.mimetype || 'application/octet-stream'
      };base64,${file.buffer.toString('base64')}`;
      const result = await cloudinaryUploadDataUrl(dataUrl, opts);
      console.log('[user/avatar] cloudinary result', result && result.secure_url);
      url = result && result.secure_url;
    } else {
      // fallback to returning data URL
      url = `data:${file.mimetype || 'application/octet-stream'};base64,${file.buffer.toString(
        'base64'
      )}`;
    }

    // update user record
    const models = require('../models');
    const { User } = models;
    try {
      console.log('[user/avatar] updating user', {
        id: req.user && req.user.id,
        role: req.user && req.user.role,
        url_length: url ? String(url).length : 0,
      });
      const u = await User.findByPk(req.user.id);
      if (!u) {
        console.warn('[user/avatar] user not found for id', req.user && req.user.id);
        return res.status(404).json({ error: 'user not found' });
      }
      await u.update({ avatar: url });
      const out = u.get ? u.get({ plain: true }) : u;
      return res.json({ user: out });
    } catch (dbErr) {
      // Log detailed DB error and return a helpful message
      console.error(
        '[user/avatar] failed to save avatar for user',
        req.user && req.user.id,
        'role=',
        req.user && req.user.role,
        dbErr && dbErr.message
      );
      // If this looks like a data length/truncation issue, hint to run migrations
      const detail = dbErr && dbErr.message ? dbErr.message : String(dbErr);
      return res.status(500).json({ error: 'failed_to_save_avatar', detail });
    }
  } catch (e) {
    console.error('user avatar upload failed', e && e.message);
    return res.status(500).json({ error: 'upload failed', detail: e && e.message });
  }
});

// Create a document record for the current tenant (used by tenant UI to save uploaded docs)
router.post('/documents', async (req, res) => {
  try {
    const { title, file_url, file_type } = req.body;
    if (!file_url) return res.status(400).json({ error: 'file_url required' });
    const models = require('../models');
    const { Document } = models;
    if (!Document) return res.status(500).json({ error: 'document model not available' });
    const doc = await Document.create({
      title: title || null,
      file_url,
      file_type: file_type || null,
      uploaded_by: req.user.id,
      societyId: req.user.societyId,
    });
    res.json({ document: doc });
  } catch (e) {
    console.error('tenant create doc failed', e && e.message);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Alias route so clients posting to /api/tenant/documents succeed (frontend uses /api/tenant/* paths)
router.post('/tenant/documents', async (req, res) => {
  try {
    const { title, file_url, file_type } = req.body;
    if (!file_url) return res.status(400).json({ error: 'file_url required' });
    const models = require('../models');
    const { Document } = models;
    if (!Document) return res.status(500).json({ error: 'document model not available' });
    const doc = await Document.create({
      title: title || null,
      file_url,
      file_type: file_type || null,
      uploaded_by: req.user.id,
      societyId: req.user.societyId,
    });
    res.json({ document: doc });
  } catch (e) {
    console.error('tenant create doc (alias) failed', e && e.message);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// List documents uploaded by the current tenant
router.get('/documents', async (req, res) => {
  try {
    const models = require('../models');
    const { Document } = models;
    if (!Document) return res.status(500).json({ error: 'document model not available' });
    const docs = await Document.findAll({
      where: { uploaded_by: req.user.id, societyId: req.user.societyId },
    });
    res.json({ documents: docs });
  } catch (e) {
    console.error('tenant documents list failed', e && e.message);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Alias to support frontend posting/reading from /api/tenant/documents
router.get('/tenant/documents', async (req, res) => {
  try {
    const models = require('../models');
    const { Document } = models;
    if (!Document) return res.status(500).json({ error: 'document model not available' });
    const docs = await Document.findAll({
      where: { uploaded_by: req.user.id, societyId: req.user.societyId },
    });
    res.json({ documents: docs });
  } catch (e) {
    console.error('tenant documents list (alias) failed', e && e.message);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Tenant: mark a bill (assigned to this tenant) as paid by uploading payment proof
// Endpoint renamed to /api/bills/:id/mark-paid
router.post('/bills/:id/mark-paid', async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_proof_url } = req.body;
    if (!payment_proof_url) return res.status(400).json({ error: 'payment_proof_url required' });

    // Try to find a Bill first
    const models = require('../models');
    const { Bill } = models;
    if (!Bill) return res.status(404).json({ error: 'bills not available' });

    const bill = await Bill.findByPk(id);
    if (!bill) return res.status(404).json({ error: 'not found' });
    if (bill.societyId !== req.user.societyId) return res.status(404).json({ error: 'not found' });
    // Only assigned tenant may mark as paid
    if (!bill.assigned_to || String(bill.assigned_to) !== String(req.user.id))
      return res.status(403).json({ error: 'forbidden' });

    await bill.update({ payment_proof_url, payment_by: req.user.id, status: 'payment_pending' });
    return res.json({ bill });
  } catch (e) {
    console.error('tenant mark-paid failed', e && e.message);
    return res.status(500).json({ error: 'failed', detail: e && e.message });
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
    const allowed = [
      'name',
      'phone',
      'email',
      'address',
      'avatar',
      'mobile_number',
      'emergency_contact',
    ];
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

// Backwards-compatible alias routes under /api/tenant/* so older clients that post to
// /api/tenant/complaints or /api/tenant/maintenance continue to work when the router
// is mounted at /api (instead of /api/tenant).

// Alias: POST /tenant/complaints -> same as POST /complaints
router.post('/tenant/complaints', async (req, res) => {
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
    console.error('tenant create complaint (alias) failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Alias: GET /tenant/complaints -> same as GET /complaints
router.get('/tenant/complaints', async (req, res) => {
  try {
    const items = await Complaint.findAll({
      where: { societyId: req.user.societyId, raised_by: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    res.json({ complaints: items });
  } catch (e) {
    console.error('tenant complaints list (alias) failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Alias: POST /tenant/maintenance -> same as POST /maintenance
router.post('/tenant/maintenance', async (req, res) => {
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
    console.error('tenant create maintenance (alias) failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Alias: GET /tenant/maintenance -> same as GET /maintenance
router.get('/tenant/maintenance', async (req, res) => {
  try {
    const complaints = await Complaint.findAll({
      where: { societyId: req.user.societyId, raised_by: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    const bills = await Bill.findAll({
      where: { societyId: req.user.societyId, assigned_to: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    const combined = [
      ...bills.map((b) => ({ ...(b.get ? b.get({ plain: true }) : b), _type: 'bill' })),
      ...complaints.map((c) => ({ ...(c.get ? c.get({ plain: true }) : c), _type: 'complaint' })),
    ];
    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ maintenance: combined });
  } catch (e) {
    console.error('tenant maintenance list (alias) failed', e);
    res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

// Alias uploads: POST /tenant/upload and /tenant/upload_form
router.post('/tenant/upload', async (req, res) => {
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
      const result = await cloudinaryUploadDataUrl(dataUrl, opts);
      return res.json({ url: result && result.secure_url });
    }
    return res.json({ url: dataUrl });
  } catch (e) {
    console.error('tenant upload (alias) failed', e && e.message, e && e.stack, e);
    return res.status(500).json({ error: 'upload failed', detail: e && (e.message || e) });
  }
});

router.post('/tenant/upload_form', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'file required' });
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
      const result = await cloudinaryUploadDataUrl(dataUrl, opts);
      return res.json({ url: result && result.secure_url });
    }
    const base64 = file.buffer.toString('base64');
    const mime = file.mimetype || 'application/octet-stream';
    return res.json({ url: `data:${mime};base64,${base64}` });
  } catch (e) {
    console.error('tenant upload_form (alias) failed', e && e.message, e && e.stack, e);
    return res.status(500).json({ error: 'upload failed', detail: e && (e.message || e) });
  }
});

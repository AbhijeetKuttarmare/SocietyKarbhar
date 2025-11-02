const express = require('express');
const router = express.Router();
const { User, Flat, Complaint, Document, Agreement, Bill } = require('../models');
const { Op } = require('sequelize');
const { authenticate, authorize } = require('../middlewares/auth');
const cloudinary = require('cloudinary').v2;
let puppeteer = null;
try {
  // require puppeteer optionally; if not installed the server will still run and
  // agreement generation will fall back to uploading HTML data URLs.
  // Install with `npm install puppeteer` in backend to enable PDF generation.
  // eslint-disable-next-line global-require
  puppeteer = require('puppeteer');
} catch (e) {
  console.warn('[owner/routes] puppeteer not available, PDF generation disabled');
}
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// helper: generate agreement HTML/PDF, upload to cloudinary (if configured) and
// update agreement.file_url + create Document records for tenant & owner.
async function generateAndSaveAgreement({
  agreement,
  tenant,
  ownerUser,
  flat,
  move_in,
  rent,
  deposit,
  witness1,
  witness2,
  societyId,
}) {
  const createdDocs = [];
  if (!agreement) return { agreement: null, documents: createdDocs };
  try {
    const generateRentAgreement = require('../templates/RentAgreement');

    function escapeHtml(str) {
      if (!str && str !== 0) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    const moveInDateFormatted = move_in || new Date().toLocaleDateString();
    const agreementText = generateRentAgreement({
      owner: { name: ownerUser.name, address: ownerUser.address, contact: ownerUser.phone },
      tenant: { name: tenant.name, address: tenant.address, contact: tenant.phone },
      moveInDate: moveInDateFormatted,
      rentAmount: rent || '',
      rentInWords: '',
      securityDeposit: deposit || '',
      tenancyPeriod: '',
      witness1: witness1 || '',
      witness2: witness2 || '',
    });

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Rent Agreement</title><style>body{font-family: Arial, Helvetica, sans-serif; padding:20px;} pre{white-space:pre-wrap; font-family:inherit;}</style></head><body><pre>${escapeHtml(
      agreementText
    )}</pre></body></html>`;

    let uploadedUrl = null;
    console.log('[owner/generate] starting agreement generation for tenant', tenant && tenant.id);

    if (puppeteer) {
      console.log('[owner/generate] puppeteer available — attempting PDF render');
      try {
        const browser = await puppeteer.launch({
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();

        const pdfDataUrl = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;

        if (
          process.env.CLOUDINARY_CLOUD_NAME &&
          process.env.CLOUDINARY_API_KEY &&
          process.env.CLOUDINARY_API_SECRET
        ) {
          try {
            const opts = { folder: 'society_karbhar/agreements', resource_type: 'raw' };
            const result = await cloudinary.uploader.upload(pdfDataUrl, opts);
            uploadedUrl = result && result.secure_url ? result.secure_url : pdfDataUrl;
            console.log('[owner/generate] uploaded PDF to Cloudinary', uploadedUrl);
          } catch (e) {
            console.warn('[owner/generate] cloudinary upload (pdf) failed', e && e.message);
            uploadedUrl = pdfDataUrl;
          }
        } else {
          uploadedUrl = pdfDataUrl;
          console.log('[owner/generate] pdf generated (no cloudinary configured)');
        }
      } catch (e) {
        console.warn(
          '[owner/generate] pdf generation failed, falling back to HTML upload',
          e && e.message
        );
      }
    } else {
      console.log('[owner/generate] puppeteer not available — skipping PDF render');
    }

    if (!uploadedUrl) {
      try {
        const dataUrl = `data:text/html;base64,${Buffer.from(html).toString('base64')}`;
        if (
          process.env.CLOUDINARY_CLOUD_NAME &&
          process.env.CLOUDINARY_API_KEY &&
          process.env.CLOUDINARY_API_SECRET
        ) {
          try {
            const opts = { folder: 'society_karbhar/agreements' };
            const result = await cloudinary.uploader.upload(dataUrl, opts);
            uploadedUrl = result && result.secure_url ? result.secure_url : dataUrl;
            console.log('[owner/generate] uploaded HTML fallback to Cloudinary', uploadedUrl);
          } catch (e2) {
            console.warn(
              '[owner/generate] cloudinary upload (html fallback) failed',
              e2 && e2.message
            );
            uploadedUrl = dataUrl;
          }
        } else {
          uploadedUrl = dataUrl;
          console.log('[owner/generate] HTML fallback prepared (no cloudinary)');
        }
      } catch (e2) {
        console.warn('[owner/generate] fallback upload failed', e2 && e2.message);
      }
    }

    // Persist file_url to agreement and start_date
    try {
      await agreement.update({ file_url: uploadedUrl, start_date: move_in || null });
    } catch (e) {
      console.warn(
        '[owner/generate] failed to update agreement with file_url',
        e && (e.stack || e.message)
      );
    }

    // create document records for tenant and owner
    try {
      const fileType =
        uploadedUrl && uploadedUrl.startsWith('data:application/pdf')
          ? 'application/pdf'
          : 'text/html';
      try {
        const docTenant = await Document.create({
          title: 'Rent Agreement',
          file_url: uploadedUrl,
          file_type: fileType,
          uploaded_by: tenant.id,
          societyId,
        });
        createdDocs.push(docTenant);
      } catch (e) {
        console.warn('[owner/generate] failed to create tenant agreement document', e && e.message);
      }
      try {
        const docOwner = await Document.create({
          title: 'Rent Agreement (owner copy)',
          file_url: uploadedUrl,
          file_type: fileType,
          uploaded_by: ownerUser.id,
          societyId,
        });
        createdDocs.push(docOwner);
      } catch (e) {
        console.warn('[owner/generate] failed to create owner agreement document', e && e.message);
      }
      console.log('[owner/generate] created agreement documents for tenant and owner');
    } catch (e) {
      console.warn(
        '[owner/generate] failed to create agreement document records',
        e && (e.stack || e.message)
      );
    }

    return { agreement, documents: createdDocs };
  } catch (e) {
    console.warn('[owner/generate] agreement generation failed', e && (e.stack || e.message));
    return { agreement, documents: createdDocs };
  }
}

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
      witness1,
      witness2,
    } = req.body;
    const phone = String(rawPhone || '').replace(/\D/g, '');
    // debug: log incoming create tenant request (key fields only)
    try {
      console.log('[owner/create] incoming req.body keys=', Object.keys(req.body || {}));
      console.log('[owner/create] fields:', {
        name: name || null,
        phone: phone || null,
        flatId: flatId || null,
        aadhaar: req.body.aadhaar_url || req.body.aadhaar || null,
        pan: req.body.pan_url || req.body.pan || null,
      });
    } catch (e) {
      console.warn('[owner/create] failed to log request body', e && e.message);
    }
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

    console.log('[owner/create] created user id=', user && user.id, 'phone=', user && user.phone);

    // capture created agreement & documents so we can return them in the response
    let createdAgreement = null;
    const createdDocuments = [];

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
    // ensure the flat is assigned to an owner. Agreement creation/generation is
    // deferred to the dedicated endpoint POST /tenants/:id/generate-agreement
    // which the client should call after creating/updating the tenant.
    if (flatId) {
      try {
        const f = await Flat.findByPk(flatId);
        if (!f || f.societyId !== req.user.societyId) {
          console.warn(
            '[owner/create] flat not found or not in owner society',
            flatId,
            'found=',
            !!f,
            'flat.societyId=',
            f && f.societyId,
            'req.user.societyId=',
            req.user.societyId
          );
        } else {
          try {
            console.log('[owner/create] flat found (deferred agreement creation)', {
              id: f.id,
              flat_no: f.flat_no,
              ownerId: f.ownerId,
              societyId: f.societyId,
            });
          } catch (e) {}
          // ensure the flat has an ownerId; if missing, set to current owner
          if (!f.ownerId) {
            try {
              await f.update({ ownerId: req.user.id });
            } catch (e) {
              console.warn('[owner/create] failed to assign owner to flat', e && e.message);
            }
          }
          console.log(
            '[owner/create] agreement creation deferred to /tenants/:id/generate-agreement'
          );
        }
      } catch (err) {
        console.warn('[owner/create] validation for flat failed', err && err.message);
      }
    }

    // return created agreement and documents (if any) so frontend can show them immediately
    try {
      console.log(
        '[owner/create] responding user=',
        user && user.id,
        'agreement=',
        createdAgreement && createdAgreement.id,
        'documentsCount=',
        (createdDocuments || []).length
      );
    } catch (e) {}
    return res.json({ user, agreement: createdAgreement, documents: createdDocuments });
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

    // If a flatId is provided in the update body, validate and ensure the flat
    // belongs to this society and has an owner assigned. Agreement creation is
    // deferred — the client should call POST /tenants/:id/generate-agreement to
    // create + generate the agreement after the tenant update.
    const { flatId } = req.body;
    // hold any generated agreement/documents during update so we can return them
    let updatedAgreementResult = null;
    if (flatId) {
      try {
        const f = await Flat.findByPk(flatId);
        if (!f || f.societyId !== req.user.societyId) {
          console.warn('[owner/update] flat not found or not in owner society', flatId);
        } else {
          // ensure flat has an owner; prefer existing ownerId otherwise assign to current owner
          if (!f.ownerId) {
            try {
              await f.update({ ownerId: req.user.id });
            } catch (e) {
              console.warn('[owner/update] failed to assign owner to flat', e && e.message);
            }
          }
          console.log(
            '[owner/update] flat validated; agreement creation deferred to /tenants/:id/generate-agreement'
          );
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

    // include any agreement/documents produced during update
    if (
      updatedAgreementResult &&
      (updatedAgreementResult.documents || updatedAgreementResult.agreement)
    ) {
      return res.json({
        user: tenant,
        agreement: updatedAgreementResult.agreement || null,
        documents: updatedAgreementResult.documents || [],
      });
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

// Generate rent agreement PDF/html, upload and create Document records for an existing tenant
router.post('/tenants/:id/generate-agreement', async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = await User.findByPk(id);
    if (!tenant || tenant.societyId !== req.user.societyId)
      return res.status(404).json({ error: 'not found' });

    const { flatId, move_in, rent, deposit, witness1, witness2 } = req.body;
    if (!flatId) return res.status(400).json({ error: 'flatId required to create agreement' });

    const flat = await Flat.findByPk(flatId);
    if (!flat || flat.societyId !== req.user.societyId)
      return res.status(400).json({ error: 'invalid flatId' });

    // ensure flat has an ownerId; if missing, assign to current owner
    let finalOwnerId = flat.ownerId || req.user.id;
    if (!flat.ownerId) {
      try {
        await flat.update({ ownerId: req.user.id });
        finalOwnerId = req.user.id;
      } catch (e) {
        console.warn('[owner/generate-endpoint] failed to assign owner to flat', e && e.message);
      }
    }

    // create Agreement record (gracefully handle missing witness columns)
    let agreement = null;
    try {
      agreement = await Agreement.create({
        flatId,
        ownerId: finalOwnerId,
        tenantId: tenant.id,
        witness1: witness1 || null,
        witness2: witness2 || null,
      });
      console.log(
        '[owner/generate-endpoint] Agreement.create success id=',
        agreement && agreement.id
      );
    } catch (createErr) {
      const msg = (createErr && createErr.message) || '';
      console.error(
        '[owner/generate-endpoint] Agreement.create error',
        createErr && (createErr.stack || createErr.message)
      );
      if (/witness1|witness2|column .* does not exist|unknown column/i.test(msg)) {
        console.warn(
          '[owner/generate-endpoint] Agreement.create failed due to missing witness columns; retrying without witness fields'
        );
        try {
          agreement = await Agreement.create({
            flatId,
            ownerId: finalOwnerId,
            tenantId: tenant.id,
          });
          console.log(
            '[owner/generate-endpoint] Agreement.create success (no witness fields) id=',
            agreement && agreement.id
          );
        } catch (e2) {
          console.error(
            '[owner/generate-endpoint] failed to create agreement without witness fields',
            e2 && (e2.stack || e2.message)
          );
          return res
            .status(500)
            .json({ error: 'failed to create agreement', detail: e2 && e2.message });
        }
      } else {
        return res
          .status(500)
          .json({ error: 'failed to create agreement', detail: createErr && createErr.message });
      }
    }

    // generate PDF/html, upload and create document records
    try {
      console.log(
        '[owner/generate-endpoint] calling generateAndSaveAgreement for agreement id=',
        agreement && agreement.id
      );
      const result = await generateAndSaveAgreement({
        agreement,
        tenant,
        ownerUser: req.user,
        flat,
        move_in,
        rent,
        deposit,
        witness1,
        witness2,
        societyId: req.user.societyId,
      });
      console.log('[owner/generate-endpoint] generateAndSaveAgreement result:', {
        agreementId: result && result.agreement && result.agreement.id,
        documentsCount: result && result.documents && result.documents.length,
      });
      return res.json({
        agreement: result && result.agreement,
        documents: result && result.documents,
      });
    } catch (e) {
      console.error(
        '[owner/generate-endpoint] generateAndSaveAgreement failed',
        e && (e.stack || e.message)
      );
      return res.status(500).json({ error: 'generation_failed', detail: e && e.message });
    }
  } catch (e) {
    console.error('owner generate-agreement endpoint failed', e && e.message);
    return res.status(500).json({ error: 'failed', detail: e && e.message });
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

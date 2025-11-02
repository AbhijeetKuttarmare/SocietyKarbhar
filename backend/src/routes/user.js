const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');

// Return the current authenticated user with helpful associations (society/adminSocieties)
router.get('/me', authenticate, async (req, res) => {
  try {
    const models = require('../models');
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'not authenticated' });

    const full = await models.User.findByPk(userId, {
      include: [{ model: models.Society, as: 'adminSocieties', through: { attributes: [] } }],
    });
    const out =
      full && full.get
        ? full.get({ plain: true })
        : { id: req.user.id, name: req.user.name, phone: req.user.phone, role: req.user.role };

    // attach direct society if the user has societyId (owner/tenant)
    if (out.societyId) {
      try {
        const soc = await models.Society.findByPk(out.societyId);
        out.society = soc ? soc.get({ plain: true }) : null;
      } catch (e) {
        out.society = null;
      }
    }

    // if user is admin and has adminSocieties, expose the first society for convenience
    try {
      if (!out.society && Array.isArray(out.adminSocieties) && out.adminSocieties.length) {
        out.society = out.adminSocieties[0];
      }
      if (out.society && !out.societyName) out.societyName = out.society.name || out.societyName;
    } catch (e) {}

    return res.json({ user: out });
  } catch (err) {
    console.error('[user] /me error', err && (err.stack || err));
    return res.status(500).json({ error: 'internal server error' });
  }
});

// Update current authenticated user (partial update)
router.put('/', authenticate, async (req, res) => {
  try {
    const models = require('../models');
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'not authenticated' });

    // allow partial updates for common profile fields
    const allowed = ['name', 'phone', 'avatar', 'address', 'email', 'emergency_contact'];
    const payload = {};
    for (const k of allowed) if (typeof req.body[k] !== 'undefined') payload[k] = req.body[k];

    // accept mobile_number as an alias for phone from some clients
    if (!payload.phone && typeof req.body.mobile_number !== 'undefined') {
      payload.phone = req.body.mobile_number;
    }

    const u = await models.User.findByPk(userId);
    if (!u) return res.status(404).json({ error: 'user not found' });
    await u.update(payload);

    // return an enriched user (same shape as GET /me) so clients get the up-to-date representation
    const fresh = await models.User.findByPk(userId, {
      include: [{ model: models.Society, as: 'adminSocieties', through: { attributes: [] } }],
    });
    const out =
      fresh && fresh.get ? fresh.get({ plain: true }) : u.get ? u.get({ plain: true }) : u;
    return res.json({ user: out });
  } catch (err) {
    console.error('[user] update error', err && (err.stack || err));
    return res.status(500).json({ error: 'internal server error' });
  }
});

module.exports = router;

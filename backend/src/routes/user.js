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

module.exports = router;

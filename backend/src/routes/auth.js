const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User, OTP } = require('../models');

// Simple phone+password login for scaffold
router.post('/login', async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) return res.status(400).json({ error: 'phone and password required' });
  const user = await User.findOne({ where: { phone } });
  if (!user) return res.status(401).json({ error: 'invalid creds' });
  const ok = await bcrypt.compare(password, user.password_hash || '');
  if (!ok) return res.status(401).json({ error: 'invalid creds' });

  // Prevent login for deactivated users
  if (user.status === 'inactive') return res.status(403).json({ error: 'account deactivated' });
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'dev', {
    expiresIn: '7d',
  });
  // Return user with helpful associations so frontend can show society names in headers
  try {
    const models = require('../models');
    const full = await models.User.findByPk(user.id, {
      include: [{ model: models.Society, as: 'adminSocieties', through: { attributes: [] } }],
    });
    const out =
      full && full.get
        ? full.get({ plain: true })
        : { id: user.id, name: user.name, phone: user.phone, role: user.role };
    // If user has a direct societyId (owner/tenant), attach the society object
    if (user.societyId) {
      try {
        const soc = await models.Society.findByPk(user.societyId);
        out.society = soc ? soc.get({ plain: true }) : null;
      } catch (e) {
        out.society = null;
      }
    }
    // If user is an admin with adminSocieties, expose the first society as `society` to simplify front-end
    try {
      if (!out.society && Array.isArray(out.adminSocieties) && out.adminSocieties.length) {
        out.society = out.adminSocieties[0];
      }
      if (out.society && !out.societyName) out.societyName = out.society.name || out.societyName;
    } catch (e) {}
    return res.json({ token, user: out });
  } catch (e) {
    // fallback to minimal user if include fails
    return res.json({
      token,
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
    });
  }
});

// OTP request: generate a code and store it (in production send via SMS)
router.post('/otp/request', async (req, res) => {
  try {
    let { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone required' });
    // normalize phone: strip non-digits so different formatting doesn't block login
    phone = String(phone).replace(/\D/g, '');
    // only allow OTPs for phones that exist in the system
    const userExists = await User.findOne({ where: { phone } });
    if (!userExists) return res.status(401).json({ error: 'phone not registered' });
    if (userExists.status === 'inactive')
      return res.status(403).json({ error: 'account deactivated' });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires_at = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await OTP.create({ phone, code, expires_at });
    // TODO: send SMS via provider; for now log
    console.log(`OTP for ${phone}: ${code}`);
    if (process.env.NODE_ENV === 'production') {
      return res.json({ ok: true, message: 'OTP sent' });
    } else {
      // In development return the code so testing is easy without SMS
      return res.json({ ok: true, message: 'OTP sent (dev)', code });
    }
  } catch (err) {
    console.error('[auth] OTP request error', err && (err.stack || err));
    // In non-production return the error message to help debugging; in production be generic
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ error: 'internal server error' });
    }
    return res.status(500).json({ error: 'internal server error', details: err && err.message });
  }
});

// OTP verify: check code, create/find user and return JWT
router.post('/otp/verify', async (req, res) => {
  try {
    let { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ error: 'phone and code required' });
    phone = String(phone).replace(/\D/g, '');
    const otp = await OTP.findOne({
      where: { phone, code, used: false },
      order: [['createdAt', 'DESC']],
    });
    if (!otp) return res.status(400).json({ error: 'invalid code' });
    if (new Date(otp.expires_at) < new Date())
      return res.status(400).json({ error: 'code expired' });
    otp.used = true;
    await otp.save();
    // find user — only allow verification for existing users
    const user = await User.findOne({ where: { phone } });
    if (!user) return res.status(401).json({ error: 'phone not registered' });
    if (user.status === 'inactive') return res.status(403).json({ error: 'account deactivated' });
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'dev', {
      expiresIn: '7d',
    });
    try {
      const models = require('../models');
      const full = await models.User.findByPk(user.id, {
        include: [{ model: models.Society, as: 'adminSocieties', through: { attributes: [] } }],
      });
      const out =
        full && full.get
          ? full.get({ plain: true })
          : { id: user.id, name: user.name, phone: user.phone, role: user.role };
      if (user.societyId) {
        try {
          const soc = await models.Society.findByPk(user.societyId);
          out.society = soc ? soc.get({ plain: true }) : null;
        } catch (e) {
          out.society = null;
        }
      }
      try {
        if (!out.society && Array.isArray(out.adminSocieties) && out.adminSocieties.length) {
          out.society = out.adminSocieties[0];
        }
        if (out.society && !out.societyName) out.societyName = out.society.name || out.societyName;
      } catch (e) {}
      return res.json({ token, user: out });
    } catch (e) {
      return res.json({
        token,
        user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
      });
    }
  } catch (err) {
    console.error('[auth] OTP verify error', err && (err.stack || err));
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ error: 'internal server error' });
    }
    return res.status(500).json({ error: 'internal server error', details: err && err.message });
  }
});

module.exports = router;

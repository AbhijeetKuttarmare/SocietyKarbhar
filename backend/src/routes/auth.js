const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User, OTP } = require('../models');

// Simple phone+password login for scaffold
router.post('/login', async (req, res) => {
  const { phone, password } = req.body;
  if(!phone || !password) return res.status(400).json({ error: 'phone and password required' });
  const user = await User.findOne({ where: { phone } });
  if(!user) return res.status(401).json({ error: 'invalid creds' });
  const ok = await bcrypt.compare(password, user.password_hash || '');
  if(!ok) return res.status(401).json({ error: 'invalid creds' });
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'dev', { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, phone: user.phone, role: user.role } });
});

// OTP request: generate a code and store it (in production send via SMS)
router.post('/otp/request', async (req, res) => {
  const { phone } = req.body;
  if(!phone) return res.status(400).json({ error: 'phone required' });
  // only allow OTPs for phones that exist in the system
  const userExists = await User.findOne({ where: { phone } });
  if(!userExists) return res.status(401).json({ error: 'phone not registered' });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires_at = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  await OTP.create({ phone, code, expires_at });
  // TODO: send SMS via provider; for now log
  console.log(`OTP for ${phone}: ${code}`);
  if(process.env.NODE_ENV === 'production'){
    res.json({ ok: true, message: 'OTP sent' });
  }else{
    // In development return the code so testing is easy without SMS
    res.json({ ok: true, message: 'OTP sent (dev)', code });
  }
});

// OTP verify: check code, create/find user and return JWT
router.post('/otp/verify', async (req, res) => {
  const { phone, code } = req.body;
  if(!phone || !code) return res.status(400).json({ error: 'phone and code required' });
  const otp = await OTP.findOne({ where: { phone, code, used: false }, order: [['createdAt','DESC']] });
  if(!otp) return res.status(400).json({ error: 'invalid code' });
  if(new Date(otp.expires_at) < new Date()) return res.status(400).json({ error: 'code expired' });
  otp.used = true;
  await otp.save();
  // find or create user
  // only allow verification for existing users
  const user = await User.findOne({ where: { phone } });
  if(!user) return res.status(401).json({ error: 'phone not registered' });
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'dev', { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, phone: user.phone, role: user.role } });
});

module.exports = router;

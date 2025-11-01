require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;

// Centralize Cloudinary configuration so all routers can use cloudinary.uploader
if (
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
) {
  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    console.log('[app] Cloudinary configured for', process.env.CLOUDINARY_CLOUD_NAME);
    // also set CLOUDINARY_URL for modules that check that
    if (!process.env.CLOUDINARY_URL) {
      process.env.CLOUDINARY_URL = `cloudinary://${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}@${process.env.CLOUDINARY_CLOUD_NAME}`;
    }
  } catch (e) {
    console.warn('cloudinary central config failed', e && e.message);
  }
}
const app = express();

// Allow larger JSON bodies for base64 image uploads from mobile clients
app.use(express.json({ limit: '10mb' }));
// Also accept URL-encoded bodies with larger limits if clients send form data
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors());

app.get('/', (req, res) => res.json({ ok: true, message: 'Society Karbhar API' }));

// routers
const authRouter = require('./routes/auth');
app.use('/api/auth', authRouter);
const superadminRouter = require('./routes/superadmin');
app.use('/api/superadmin', superadminRouter);
const adminRouter = require('./routes/admin');
app.use('/api/admin', adminRouter);
const ownerRouter = require('./routes/owner');
app.use('/api/owner', ownerRouter);
// Notices (public to authenticated users)
const noticesRouter = require('./routes/notices');
app.use('/api/notices', noticesRouter);
// Tenant routes (maintenance / complaints)
const tenantRouter = require('./routes/tenant');
app.use('/api', tenantRouter);

// current user helper (returns enriched user for the token)
const userRouter = require('./routes/user');
app.use('/api/user', userRouter);

module.exports = app;

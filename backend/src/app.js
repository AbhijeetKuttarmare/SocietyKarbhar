require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;

// Centralize Cloudinary configuration so all routers can use cloudinary.uploader
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
	try {
		cloudinary.config({
			cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
			api_key: process.env.CLOUDINARY_API_KEY,
			api_secret: process.env.CLOUDINARY_API_SECRET,
			secure: true,
		});
		// also set CLOUDINARY_URL for modules that check that
		if (!process.env.CLOUDINARY_URL) {
			process.env.CLOUDINARY_URL = `cloudinary://${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}@${process.env.CLOUDINARY_CLOUD_NAME}`;
		}
	} catch (e) {
		console.warn('cloudinary central config failed', e && e.message);
	}
}
const app = express();

app.use(express.json());
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

module.exports = app;

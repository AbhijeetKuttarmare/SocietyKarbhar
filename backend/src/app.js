require('dotenv').config();
const express = require('express');
const cors = require('cors');
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

module.exports = app;

const express = require('express');
const router = express.Router();
const { Notice, NoticeRecipient } = require('../models');
const { authenticate } = require('../middlewares/auth');

router.use(authenticate);

// List notices for the current user's society
router.get('/', async (req, res) => {
  try{
    // fetch all notices for society, then filter per-recipient (recipient rows mean targeted)
    const notices = await Notice.findAll({ where: { societyId: req.user.societyId }, order: [['createdAt','DESC']] });
    const noticeIds = notices.map(n=>n.id);
    const recipients = await NoticeRecipient.findAll({ where: { noticeId: noticeIds } });
    // map noticeId -> list of userIds
    const recMap = {};
    recipients.forEach(r=>{ recMap[r.noticeId] = recMap[r.noticeId] || []; recMap[r.noticeId].push(String(r.userId)); });
    // include notice if it has no recipients (global) OR current user is in recipient list
    const filtered = notices.filter(n=>{
      const list = recMap[n.id] || [];
      if(list.length === 0) return true;
      return list.includes(String(req.user.id));
    });
    res.json({ notices: filtered });
  }catch(e){ console.error('list notices failed', e); res.status(500).json({ error: 'failed' }); }
});

// Simple count endpoint (useful for badges)
router.get('/count', async (req, res) => {
  try{
    const notices = await Notice.findAll({ where: { societyId: req.user.societyId } });
    const noticeIds = notices.map(n=>n.id);
    const recipients = await NoticeRecipient.findAll({ where: { noticeId: noticeIds } });
    const recMap = {};
    recipients.forEach(r=>{ recMap[r.noticeId] = recMap[r.noticeId] || []; recMap[r.noticeId].push(String(r.userId)); });
    const filtered = notices.filter(n=>{ const list = recMap[n.id] || []; return list.length === 0 || list.includes(String(req.user.id)); });
    res.json({ count: filtered.length });
  }catch(e){ console.error('notices count failed', e); res.status(500).json({ error: 'failed' }); }
});

module.exports = router;

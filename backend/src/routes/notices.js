const express = require('express');
const router = express.Router();
const { Notice, NoticeRecipient } = require('../models');
const { authenticate } = require('../middlewares/auth');

router.use(authenticate);

// List notices for the current user's society
router.get('/', async (req, res) => {
  try{
    if(!req.user) return res.status(401).json({ error: 'unauthenticated' });
    // Admins see everything
    if(req.user && req.user.role === 'admin'){
      const all = await Notice.findAll({ where: { societyId: req.user.societyId }, order: [['createdAt','DESC']] });
      return res.json({ notices: all });
    }

    // fetch all notices for society, then filter per-recipient (recipient rows mean targeted)
    const notices = await Notice.findAll({ where: { societyId: req.user.societyId }, order: [['createdAt','DESC']] });
    const noticeIds = notices.map(n=>n.id);
    let recipients = [];
    if(noticeIds.length){
      recipients = await NoticeRecipient.findAll({ where: { noticeId: noticeIds } });
    }
    // map noticeId -> list of userIds
    const recMap = {};
    recipients.forEach(r=>{ recMap[r.noticeId] = recMap[r.noticeId] || []; recMap[r.noticeId].push(String(r.userId)); });
    // include notice if:
    // - it has no recipients (global), OR
    // - current user is in recipient list, OR
    // - current user is the creator of the notice (admins should see their created notices)
    const filtered = notices.filter(n=>{
      const list = recMap[n.id] || [];
      if(String(n.created_by) === String(req.user.id)) return true;
      if(list.length === 0) return true;
      return list.includes(String(req.user.id));
    });
    res.json({ notices: filtered });
  }catch(e){ console.error('list notices failed', e && e.stack ? e.stack : e); res.status(500).json({ error: e && e.message ? e.message : 'failed' }); }
});

// Simple count endpoint (useful for badges)
router.get('/count', async (req, res) => {
  try{
    if(!req.user) return res.status(401).json({ error: 'unauthenticated' });
    // Admins see the full count
    if(req.user && req.user.role === 'admin'){
      const count = await Notice.count({ where: { societyId: req.user.societyId } });
      return res.json({ count });
    }

    const notices = await Notice.findAll({ where: { societyId: req.user.societyId } });
    const noticeIds = notices.map(n=>n.id);
    let recipients = [];
    if(noticeIds.length){
      recipients = await NoticeRecipient.findAll({ where: { noticeId: noticeIds } });
    }
    const recMap = {};
    recipients.forEach(r=>{ recMap[r.noticeId] = recMap[r.noticeId] || []; recMap[r.noticeId].push(String(r.userId)); });
    const filtered = notices.filter(n=>{ const list = recMap[n.id] || []; return list.length === 0 || list.includes(String(req.user.id)); });
    res.json({ count: filtered.length });
  }catch(e){ console.error('notices count failed', e && e.stack ? e.stack : e); res.status(500).json({ error: e && e.message ? e.message : 'failed' }); }
});

module.exports = router;

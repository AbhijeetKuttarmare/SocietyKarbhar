const express = require('express');
const router = express.Router();
const db = require('../models');

// Public endpoint to receive Google Form (or other) submissions and create Visitor records.
// Supports an optional secret via header `x-form-secret` or query `?secret=` matched against
// process.env.GOOGLE_FORM_SECRET. If the env var is not set, the endpoint is open.

function normalizeBody(body) {
  const map = {};
  if (!body || typeof body !== 'object') return map;
  Object.keys(body).forEach((k) => {
    const nk = String(k || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    map[nk] = body[k];
  });
  return map;
}

router.post('/google-form-visitor', async (req, res) => {
  try {
    const secret = process.env.GOOGLE_FORM_SECRET;
    const incoming = req.get('x-form-secret') || req.query.secret || (req.body && req.body.secret);
    if (secret && incoming !== secret) return res.status(403).json({ error: 'bad_secret' });

    const body = req.body || {};
    const norm = normalizeBody(body);

    const pick = (...names) => {
      for (const n of names) {
        const nk = String(n || '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');
        if (norm[nk] !== undefined) return norm[nk];
        if (body[n] !== undefined) return body[n];
      }
      return undefined;
    };

    // Flexible field mapping: try common variants used in forms
    const mainVisitorName = pick(
      'mainVisitorName',
      'name',
      'visitorName',
      'visitor_name',
      'visitor'
    );
    const selfie = pick('selfie', 'photo', 'image', 'selfie_url', 'photo_url');
    const flatId = pick('flatId', 'flat_id', 'flat', 'flatno', 'flat_no', 'flatNumber');
    const wingId = pick('wingId', 'wing_id', 'wing', 'buildingId', 'building');
    const reason = pick('reason', 'purpose', 'visit_reason', 'why', 'note');
    const numberOfPeopleRaw = pick('numberOfPeople', 'number_of_people', 'count', 'people');
    const additionalRaw = pick(
      'additionalVisitors',
      'additional',
      'additional_visitors',
      'extra',
      'others'
    );
    const checkInTimeRaw = pick('checkInTime', 'timestamp', 'time', 'checkin', 'submitted_at');
    const visitorIdGenerated = pick('visitorIdGenerated', 'visitorId', 'visitor_id', 'id');
    const gateId = pick('gateId', 'gate', 'gate_id');

    const numberOfPeople = numberOfPeopleRaw ? parseInt(numberOfPeopleRaw, 10) : null;

    let additionalVisitors = null;
    if (additionalRaw) {
      if (typeof additionalRaw === 'string') {
        try {
          additionalVisitors = JSON.parse(additionalRaw);
        } catch (e) {
          // fallback: split by comma into array of names
          additionalVisitors = additionalRaw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        }
      } else {
        additionalVisitors = additionalRaw;
      }
    }

    let checkInTime = null;
    if (checkInTimeRaw) {
      const d = new Date(checkInTimeRaw);
      if (!Number.isNaN(d.getTime())) checkInTime = d;
    }

    const payload = {
      mainVisitorName: mainVisitorName || null,
      selfie: selfie || null,
      flatId: flatId || null,
      wingId: wingId || null,
      reason: reason || null,
      numberOfPeople: Number.isInteger(numberOfPeople) ? numberOfPeople : null,
      additionalVisitors: additionalVisitors || null,
      checkInTime: checkInTime || null,
      visitorIdGenerated: visitorIdGenerated || null,
      gateId: gateId || null,
    };

    const v = await db.Visitor.create(payload);
    return res.json({ visitor: v });
  } catch (e) {
    console.error('webhook google-form-visitor failed', e && e.stack ? e.stack : e);
    return res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

module.exports = router;

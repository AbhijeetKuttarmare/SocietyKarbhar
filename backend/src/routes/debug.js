const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Unauthenticated debug endpoint to help test multipart uploads from devices/emulators.
// POST /api/debug/multipart (form field `file`) -> { ok: true, filename, mimetype, size }
router.post('/multipart', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'file required' });
    // Return some useful diagnostics so client can confirm server received the file
    return res.json({
      ok: true,
      filename: file.originalname || null,
      mimetype: file.mimetype || null,
      size: file.size || (file.buffer && file.buffer.length) || 0,
      headers: {
        host: req.headers.host,
        authorization: !!req.headers.authorization,
        'user-agent': req.headers['user-agent'],
      },
    });
  } catch (e) {
    console.error('debug multipart failed', e && e.message);
    return res.status(500).json({ error: 'failed', detail: e && e.message });
  }
});

module.exports = router;
